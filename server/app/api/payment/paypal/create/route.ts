import { createClient } from '@/lib/supabase/server';
import { createOrder } from '@/lib/paypal';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { productId } = await request.json();

    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    // Get product details
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .eq('is_active', true)
      .single();

    if (productError || !product) {
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
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        user_id: user.id,
        amount: product.price_usd,
        currency: 'USD',
        payment_method: 'paypal',
        payment_id: order.id,
        status: 'pending',
        metadata: {
          product_id: product.id,
          product_name: product.name,
        },
      });

    if (paymentError) {
      console.error('Failed to create payment record:', paymentError);
    }

    // Find the approval URL
    const approvalUrl = order.links.find((link) => link.rel === 'approve')?.href;

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
