import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDB, Payment } from '@/lib/db';


// GET /api/user/payments - Get user's payment history
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Parse query params for pagination
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
    const offset = (page - 1) * limit;

    const db = await getDB();

    // Get total count
    const countResult = await db.prepare(`
      SELECT COUNT(*) as count FROM payments WHERE user_id = ?
    `).bind(user.id).first<{ count: number }>();
    const total = countResult?.count || 0;

    type PaymentWithDetails = Payment & {
      subscription_plan_type: string;
      subscription_status: string;
      product_name: string;
    };

    // Get payments with pagination
    const { results: payments } = await db.prepare(`
      SELECT 
        pay.*,
        s.plan_type as subscription_plan_type,
        s.status as subscription_status,
        p.name as product_name
      FROM payments pay
      LEFT JOIN subscriptions s ON pay.subscription_id = s.id
      LEFT JOIN products p ON s.product_id = p.id
      WHERE pay.user_id = ?
      ORDER BY pay.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(user.id, limit, offset).all<PaymentWithDetails>();

    // Format payments
    const formattedPayments = payments.map((pay) => ({
      id: pay.id,
      paymentId: pay.payment_id,
      amount: pay.amount,
      currency: pay.currency,
      status: pay.status,
      paymentMethod: pay.payment_method,
      metadata: pay.metadata ? JSON.parse(pay.metadata) : null,
      createdAt: pay.created_at,
      subscription: pay.subscription_id ? {
        planType: pay.subscription_plan_type,
        status: pay.subscription_status,
        product: {
          name: pay.product_name,
        },
      } : null,
    }));

    return NextResponse.json({
      payments: formattedPayments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get payments error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
