export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDB, Subscription } from '@/lib/db';


// GET /api/user/subscriptions - Get user's subscriptions
export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const db = getDB();

    type SubWithProduct = Subscription & { 
      product_name: string; 
      product_description: string;
      product_price_usd: number;
      product_features: string;
    };

    const { results: subscriptions } = await db.prepare(`
      SELECT 
        s.*,
        p.id as product_id,
        p.name as product_name,
        p.description as product_description,
        p.price_usd as product_price_usd,
        p.features as product_features
      FROM subscriptions s
      LEFT JOIN products p ON s.product_id = p.id
      WHERE s.user_id = ?
      ORDER BY s.created_at DESC
    `).bind(user.id).all<SubWithProduct>();

    // Format subscriptions with nested product
    const formattedSubscriptions = subscriptions.map((sub) => ({
      id: sub.id,
      userId: sub.user_id,
      productId: sub.product_id,
      planType: sub.plan_type,
      status: sub.status,
      startedAt: sub.started_at,
      expiresAt: sub.expires_at,
      cancelledAt: sub.cancelled_at,
      createdAt: sub.created_at,
      product: {
        id: sub.product_id,
        name: sub.product_name,
        description: sub.product_description,
        priceUsd: sub.product_price_usd,
        features: sub.product_features ? JSON.parse(sub.product_features) : [],
      },
    }));

    // Get the active subscription
    const activeSubscription = formattedSubscriptions.find(
      (sub: { status: string }) => sub.status === 'active'
    );

    return NextResponse.json({
      subscriptions: formattedSubscriptions,
      activeSubscription,
    });
  } catch (error) {
    console.error('Get subscriptions error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
