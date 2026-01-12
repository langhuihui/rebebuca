import { createAdminClient } from '@/lib/supabase/server';
import { verifyWebhookSignature } from '@/lib/paypal';
import { NextRequest, NextResponse } from 'next/server';

// PayPal webhook handler
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const webhookEvent = JSON.parse(body);

    // Verify webhook signature in production
    if (process.env.PAYPAL_MODE === 'live' && process.env.PAYPAL_WEBHOOK_ID) {
      const isValid = await verifyWebhookSignature({
        webhookId: process.env.PAYPAL_WEBHOOK_ID,
        transmissionId: request.headers.get('paypal-transmission-id') || '',
        transmissionTime: request.headers.get('paypal-transmission-time') || '',
        certUrl: request.headers.get('paypal-cert-url') || '',
        authAlgo: request.headers.get('paypal-auth-algo') || '',
        transmissionSig: request.headers.get('paypal-transmission-sig') || '',
        webhookEvent,
      });

      if (!isValid) {
        console.error('Invalid webhook signature');
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
    }

    const eventType = webhookEvent.event_type;
    const resource = webhookEvent.resource;

    console.log('PayPal webhook event:', eventType);

    const supabase = createAdminClient();

    switch (eventType) {
      case 'PAYMENT.CAPTURE.COMPLETED': {
        // Payment was successfully captured
        const orderId = resource.supplementary_data?.related_ids?.order_id;
        if (orderId) {
          await supabase
            .from('payments')
            .update({
              status: 'completed',
              metadata: {
                capture_id: resource.id,
                webhook_event: eventType,
              },
            })
            .eq('payment_id', orderId);
        }
        break;
      }

      case 'PAYMENT.CAPTURE.DENIED':
      case 'PAYMENT.CAPTURE.DECLINED': {
        // Payment was denied
        const orderId = resource.supplementary_data?.related_ids?.order_id;
        if (orderId) {
          await supabase
            .from('payments')
            .update({
              status: 'failed',
              metadata: {
                webhook_event: eventType,
                reason: resource.status_details?.reason,
              },
            })
            .eq('payment_id', orderId);
        }
        break;
      }

      case 'PAYMENT.CAPTURE.REFUNDED': {
        // Payment was refunded
        const captureId = resource.id;
        // Find payment by capture ID in metadata
        const { data: payments } = await supabase
          .from('payments')
          .select('*')
          .filter('metadata->capture_id', 'eq', captureId);

        if (payments && payments.length > 0) {
          const payment = payments[0];
          
          await supabase
            .from('payments')
            .update({
              status: 'refunded',
              metadata: {
                ...payment.metadata as object,
                webhook_event: eventType,
                refund_id: resource.refund_id,
              },
            })
            .eq('id', payment.id);

          // Cancel the associated subscription
          if (payment.subscription_id) {
            await supabase
              .from('subscriptions')
              .update({
                status: 'cancelled',
                cancelled_at: new Date().toISOString(),
              })
              .eq('id', payment.subscription_id);
          }
        }
        break;
      }

      default:
        console.log('Unhandled webhook event:', eventType);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
