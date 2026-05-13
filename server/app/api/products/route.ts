import { NextResponse } from 'next/server';
import { getDB, Product } from '@/lib/db';


// GET /api/products - Get all active products
export async function GET() {
  try {
    const db = await getDB();

    const { results: products } = await db.prepare(`
      SELECT * FROM products WHERE is_active = 1 ORDER BY price_usd ASC
    `).all<Product>();

    // Parse features JSON
    const formattedProducts = products.map((p: Product) => ({
      ...p,
      features: p.features ? JSON.parse(p.features) : [],
    }));

    return NextResponse.json({ products: formattedProducts });
  } catch (error) {
    console.error('Get products error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
