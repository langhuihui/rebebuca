export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDB, generateId, Product } from '@/lib/db';
import { createOrder } from '@/lib/paypal';


export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json() as { productId?: string };
    const { productId } = body;

    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    const db = getDB();

    // Get product details
    const product = await db.prepare(`
      SELECT * FROM products WHERE id = ? AND is_active = 1
    `).bind(productId).first<Product>();

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    if (product.price_usd <= 0) {
      return NextResponse.json(
        { error: 'This product is free and does not require payment' },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Create PayPal order
    const order = await createOrder({
      amount: product.price_usd,
      currency: 'USD',
      description: `Rebebuca ${product.name} Subscription`,
      customId: JSON.stringify({
        userId: user.id,
        productId: product.id,
      }),
      returnUrl: `${appUrl}/payment/success`,
      cancelUrl: `${appUrl}/payment/cancel`,
    });

    // Create pending payment record
    const now = new Date().toISOString();
    await db.prepare(`
      INSERT INTO payments (id, user_id, payment_id, amount, currency, status, payment_method, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      generateId(),
      user.id,
      order.id,
      product.price_usd,
      'USD',
      'pending',
      'paypal',
      JSON.stringify({ product_id: product.id, product_name: product.name }),
      now,
      now
    ).run();

    // Find the approval URL
    const approvalUrl = order.links.find((link: { rel: string; href: string }) => link.rel === 'approve')?.href;

    return NextResponse.json({
      orderId: order.id,
      approvalUrl,
    });
  } catch (error) {
    console.error('Create PayPal order error:', error);
    return NextResponse.json(
      { error: 'Failed to create payment' },
      { status: 500 }
    );
  }
}
