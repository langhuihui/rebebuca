export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDB, generateId, Payment, Product } from '@/lib/db';
import { captureOrder } from '@/lib/paypal';


export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json() as { orderId?: string };
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }

    // Capture the payment
    const captureResult = await captureOrder(orderId);

    if (captureResult.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: 'Payment was not completed' },
        { status: 400 }
      );
    }

    const db = getDB();
    const now = new Date().toISOString();

    // Get payment record
    const payment = await db.prepare(`
      SELECT * FROM payments WHERE payment_id = ? AND user_id = ?
    `).bind(orderId, user.id).first<Payment>();

    if (!payment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    // Parse metadata to get product ID
    const metadata = payment.metadata ? JSON.parse(payment.metadata) : {};
    const productId = metadata.product_id;

    // Update payment status
    const captureId = captureResult.purchase_units[0]?.payments?.captures[0]?.id;
    await db.prepare(`
      UPDATE payments SET status = ?, metadata = ?, updated_at = ? WHERE id = ?
    `).bind(
      'completed',
      JSON.stringify({ ...metadata, capture_id: captureId, capture_status: captureResult.status }),
      now,
      payment.id
    ).run();

    if (productId) {
      // Get product details
      const product = await db.prepare('SELECT * FROM products WHERE id = ?').bind(productId).first<Product>();

      if (product) {
        // Determine plan type based on product name
        const planType = product.name.toLowerCase() as 'free' | 'pro' | 'enterprise';

        // Cancel existing active subscriptions
        await db.prepare(`
          UPDATE subscriptions SET status = 'cancelled', cancelled_at = ?, updated_at = ?
          WHERE user_id = ? AND status = 'active'
        `).bind(now, now, user.id).run();

        // Create new subscription
        const expiresAt = new Date();
        expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1 year subscription

        const subscriptionId = generateId();
        await db.prepare(`
          INSERT INTO subscriptions (id, user_id, product_id, plan_type, status, started_at, expires_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          subscriptionId,
          user.id,
          productId,
          planType,
          'active',
          now,
          expiresAt.toISOString(),
          now,
          now
        ).run();

        // Update payment with subscription ID
        await db.prepare(`
          UPDATE payments SET subscription_id = ?, updated_at = ? WHERE id = ?
        `).bind(subscriptionId, now, payment.id).run();
      }
    }

    return NextResponse.json({
      message: 'Payment completed successfully',
      status: captureResult.status,
    });
  } catch (error) {
    console.error('Capture PayPal order error:', error);
    return NextResponse.json(
      { error: 'Failed to capture payment' },
      { status: 500 }
    );
  }
}
