import { createClient, createAdminClient } from '@/lib/supabase/server';
import { captureOrder } from '@/lib/paypal';
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

    const { orderId } = await request.json();

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

    // Use admin client to update records
    const adminSupabase = createAdminClient();

    // Update payment record
    const { data: payment, error: paymentUpdateError } = await adminSupabase
      .from('payments')
      .update({
        status: 'completed',
        metadata: {
          capture_id: captureResult.purchase_units[0]?.payments?.captures[0]?.id,
          capture_status: captureResult.status,
        },
      })
      .eq('payment_id', orderId)
      .eq('user_id', user.id)
      .select('*, metadata')
      .single();

    if (paymentUpdateError) {
      console.error('Failed to update payment:', paymentUpdateError);
    }

    // Get product ID from payment metadata
    const productId = (payment?.metadata as Record<string, unknown>)?.product_id as string;

    if (productId) {
      // Get product details
      const { data: product } = await adminSupabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

      if (product) {
        // Determine plan type based on product name
        const planType = product.name.toLowerCase() as 'free' | 'pro' | 'enterprise';

        // Cancel existing active subscriptions
        await adminSupabase
          .from('subscriptions')
          .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
          .eq('status', 'active');

        // Create new subscription
        const expiresAt = new Date();
        expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1 year subscription

        const { data: subscription, error: subscriptionError } = await adminSupabase
          .from('subscriptions')
          .insert({
            user_id: user.id,
            product_id: productId,
            plan_type: planType,
            status: 'active',
            started_at: new Date().toISOString(),
            expires_at: expiresAt.toISOString(),
          })
          .select()
          .single();

        if (subscriptionError) {
          console.error('Failed to create subscription:', subscriptionError);
        }

        // Update payment with subscription ID
        if (subscription && payment) {
          await adminSupabase
            .from('payments')
            .update({ subscription_id: subscription.id })
            .eq('id', payment.id);
        }
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
