import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/products - Get all active products
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('price_usd', { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch products' },
        { status: 400 }
      );
    }

    return NextResponse.json({ products });
  } catch (error) {
    console.error('Get products error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
