export const runtime = 'edge';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui';
import PricingCard from '@/components/dashboard/PricingCard';
import { verifyToken } from '@/lib/auth/jwt';
import { getDB, User, Product, Subscription } from '@/lib/db';


export default async function SubscriptionsPage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  if (!accessToken) {
    redirect('/login');
  }

  const payload = await verifyToken(accessToken);
  if (!payload || payload.type !== 'access') {
    redirect('/login');
  }

  const db = getDB();
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(payload.sub).first<User>();

  if (!user) {
    redirect('/login');
  }

  // Get all products
  const { results: products } = await db.prepare(`
    SELECT * FROM products WHERE is_active = 1 ORDER BY price_usd ASC
  `).all<Product>();

  // Get user's active subscription
  const activeSubscription = await db.prepare(`
    SELECT s.*, p.name as product_name
    FROM subscriptions s
    LEFT JOIN products p ON s.product_id = p.id
    WHERE s.user_id = ? AND s.status = 'active'
    ORDER BY s.created_at DESC
    LIMIT 1
  `).bind(user.id).first<Subscription & { product_name: string }>();

  type FormattedProduct = Product & { features: string[] };

  // Parse features for products
  const formattedProducts: FormattedProduct[] = products.map((p: Product) => ({
    ...p,
    features: p.features ? JSON.parse(p.features) : [],
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Subscriptions
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage your subscription and view available plans.
        </p>
      </div>

      {/* Current subscription */}
      {activeSubscription && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Current Subscription
          </h2>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-gray-900 dark:text-white capitalize">
                  {activeSubscription.plan_type}
                </span>
                <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-600 dark:bg-green-900/30 rounded-full">
                  Active
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Started: {new Date(activeSubscription.started_at).toLocaleDateString()}
              </p>
              {activeSubscription.expires_at && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Expires: {new Date(activeSubscription.expires_at).toLocaleDateString()}
                </p>
              )}
            </div>
            {activeSubscription.plan_type !== 'free' && (
              <button className="px-4 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                Cancel Subscription
              </button>
            )}
          </div>
        </Card>
      )}

      {/* Available plans */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Available Plans
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {formattedProducts.map((product) => (
            <PricingCard
              key={product.id}
              product={product}
              isCurrentPlan={activeSubscription?.product_id === product.id}
              userId={user.id}
            />
          ))}
        </div>
      </div>

      {/* Features comparison */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Features Comparison
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-dark-600">
                <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Feature</th>
                <th className="text-center py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Free</th>
                <th className="text-center py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Pro</th>
                <th className="text-center py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Enterprise</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-dark-600">
              <tr>
                <td className="py-3 px-4 text-gray-900 dark:text-white">Terminal Sessions</td>
                <td className="py-3 px-4 text-center text-gray-600 dark:text-gray-300">10</td>
                <td className="py-3 px-4 text-center text-gray-600 dark:text-gray-300">Unlimited</td>
                <td className="py-3 px-4 text-center text-gray-600 dark:text-gray-300">Unlimited</td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-gray-900 dark:text-white">Task Management</td>
                <td className="py-3 px-4 text-center text-gray-600 dark:text-gray-300">Basic</td>
                <td className="py-3 px-4 text-center text-gray-600 dark:text-gray-300">Advanced</td>
                <td className="py-3 px-4 text-center text-gray-600 dark:text-gray-300">Advanced</td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-gray-900 dark:text-white">AI Collaboration</td>
                <td className="py-3 px-4 text-center">
                  <svg className="w-5 h-5 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </td>
                <td className="py-3 px-4 text-center">
                  <svg className="w-5 h-5 mx-auto text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </td>
                <td className="py-3 px-4 text-center">
                  <svg className="w-5 h-5 mx-auto text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-gray-900 dark:text-white">Cloud Sync</td>
                <td className="py-3 px-4 text-center">
                  <svg className="w-5 h-5 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </td>
                <td className="py-3 px-4 text-center">
                  <svg className="w-5 h-5 mx-auto text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </td>
                <td className="py-3 px-4 text-center">
                  <svg className="w-5 h-5 mx-auto text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-gray-900 dark:text-white">Team Management</td>
                <td className="py-3 px-4 text-center">
                  <svg className="w-5 h-5 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </td>
                <td className="py-3 px-4 text-center">
                  <svg className="w-5 h-5 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </td>
                <td className="py-3 px-4 text-center">
                  <svg className="w-5 h-5 mx-auto text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-gray-900 dark:text-white">Support</td>
                <td className="py-3 px-4 text-center text-gray-600 dark:text-gray-300">Community</td>
                <td className="py-3 px-4 text-center text-gray-600 dark:text-gray-300">Priority</td>
                <td className="py-3 px-4 text-center text-gray-600 dark:text-gray-300">Dedicated</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
