import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/user/subscriptions - Get user's subscriptions
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { data: subscriptions, error } = await supabase
      .from('subscriptions')
      .select(`
        *,
        product:products(*)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch subscriptions' },
        { status: 400 }
      );
    }

    // Get the active subscription
    const activeSubscription = subscriptions?.find(
      (sub) => sub.status === 'active'
    );

    return NextResponse.json({
      subscriptions,
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
