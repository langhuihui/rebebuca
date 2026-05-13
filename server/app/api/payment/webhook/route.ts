import { NextRequest, NextResponse } from 'next/server';
import { getDB, Payment } from '@/lib/db';
import { verifyWebhookSignature } from '@/lib/paypal';


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

    const db = await getDB();
    const now = new Date().toISOString();

    switch (eventType) {
      case 'PAYMENT.CAPTURE.COMPLETED': {
        // Payment was successfully captured
        const orderId = resource.supplementary_data?.related_ids?.order_id;
        if (orderId) {
          const payment = await db.prepare('SELECT * FROM payments WHERE payment_id = ?').bind(orderId).first<Payment>();
          if (payment) {
            const metadata = payment.metadata ? JSON.parse(payment.metadata) : {};
            await db.prepare(`
              UPDATE payments SET status = ?, metadata = ?, updated_at = ? WHERE payment_id = ?
            `).bind(
              'completed',
              JSON.stringify({ ...metadata, capture_id: resource.id, webhook_event: eventType }),
              now,
              orderId
            ).run();
          }
        }
        break;
      }

      case 'PAYMENT.CAPTURE.DENIED':
      case 'PAYMENT.CAPTURE.DECLINED': {
        // Payment was denied
        const orderId = resource.supplementary_data?.related_ids?.order_id;
        if (orderId) {
          const payment = await db.prepare('SELECT * FROM payments WHERE payment_id = ?').bind(orderId).first<Payment>();
          if (payment) {
            const metadata = payment.metadata ? JSON.parse(payment.metadata) : {};
            await db.prepare(`
              UPDATE payments SET status = ?, metadata = ?, updated_at = ? WHERE payment_id = ?
            `).bind(
              'failed',
              JSON.stringify({ ...metadata, webhook_event: eventType, reason: resource.status_details?.reason }),
              now,
              orderId
            ).run();
          }
        }
        break;
      }

      case 'PAYMENT.CAPTURE.REFUNDED': {
        // Payment was refunded
        const captureId = resource.id;
        // Find payment by capture ID in metadata (using LIKE since D1 doesn't support JSON queries)
        const { results: payments } = await db.prepare(`
          SELECT * FROM payments WHERE metadata LIKE ?
        `).bind(`%"capture_id":"${captureId}"%`).all<Payment>();

        if (payments && payments.length > 0) {
          const payment = payments[0];
          const metadata = payment.metadata ? JSON.parse(payment.metadata) : {};
          
          await db.prepare(`
            UPDATE payments SET status = ?, metadata = ?, updated_at = ? WHERE id = ?
          `).bind(
            'refunded',
            JSON.stringify({ ...metadata, webhook_event: eventType, refund_id: resource.refund_id }),
            now,
            payment.id
          ).run();

          // Cancel the associated subscription
          if (payment.subscription_id) {
            await db.prepare(`
              UPDATE subscriptions SET status = 'cancelled', cancelled_at = ?, updated_at = ? WHERE id = ?
            `).bind(now, now, payment.subscription_id).run();
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
