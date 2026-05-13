import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDB, Subscription, Product } from '@/lib/db';


export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const db = await getDB();

    // Get active subscription
    const subscription = await db.prepare(`
      SELECT s.*, p.name as product_name, p.features as product_features
      FROM subscriptions s
      LEFT JOIN products p ON s.product_id = p.id
      WHERE s.user_id = ? AND s.status = 'active'
      ORDER BY s.created_at DESC
      LIMIT 1
    `).bind(user.id).first<Subscription & { product_name: string; product_features: string }>();

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        locale: user.locale,
        timezone: user.timezone,
        emailVerified: user.email_verified === 1,
      },
      subscription: subscription ? {
        id: subscription.id,
        planType: subscription.plan_type,
        status: subscription.status,
        expiresAt: subscription.expires_at,
        product: {
          name: subscription.product_name,
          features: subscription.product_features ? JSON.parse(subscription.product_features) : [],
        },
      } : null,
    });
  } catch (error) {
    console.error('Get me error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
