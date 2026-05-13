
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui';
import { verifyToken } from '@/lib/auth/jwt';
import { getDB, User, Payment } from '@/lib/db';


export default async function PaymentsPage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  if (!accessToken) {
    redirect('/login');
  }

  const payload = await verifyToken(accessToken);
  if (!payload || payload.type !== 'access') {
    redirect('/login');
  }

  const db = await getDB();
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(payload.sub).first<User>();

  if (!user) {
    redirect('/login');
  }

  type PaymentWithDetails = Payment & { subscription_plan_type: string; product_name: string };

  // Get all payments
  const { results: payments } = await db.prepare(`
    SELECT 
      pay.*,
      s.plan_type as subscription_plan_type,
      p.name as product_name
    FROM payments pay
    LEFT JOIN subscriptions s ON pay.subscription_id = s.id
    LEFT JOIN products p ON s.product_id = p.id
    WHERE pay.user_id = ?
    ORDER BY pay.created_at DESC
  `).bind(user.id).all<PaymentWithDetails>();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Payment History
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          View all your transactions and payment records.
        </p>
      </div>

      <Card>
        {payments && payments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-dark-600">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                    Date
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                    Description
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                    Method
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                    Amount
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-dark-600">
                {payments.map((payment) => {
                  const metadata = payment.metadata ? JSON.parse(payment.metadata) : {};
                  const productName = payment.product_name || metadata.product_name || 'Subscription';

                  return (
                    <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-dark-700">
                      <td className="py-4 px-4">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {new Date(payment.created_at).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(payment.created_at).toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {productName} Plan
                        </div>
                        {payment.payment_id && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                            #{payment.payment_id.slice(0, 16)}...
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center">
                          {payment.payment_method === 'paypal' && (
                            <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-600 dark:bg-blue-900/30 rounded">
                              PayPal
                            </span>
                          )}
                          {payment.payment_method === 'stripe' && (
                            <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-600 dark:bg-purple-900/30 rounded">
                              Stripe
                            </span>
                          )}
                          {payment.payment_method === 'alipay' && (
                            <span className="px-2 py-1 text-xs font-medium bg-sky-100 text-sky-600 dark:bg-sky-900/30 rounded">
                              Alipay
                            </span>
                          )}
                          {payment.payment_method === 'wechat' && (
                            <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-600 dark:bg-green-900/30 rounded">
                              WeChat Pay
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          ${payment.amount.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {payment.currency}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            payment.status === 'completed'
                              ? 'bg-green-100 text-green-600 dark:bg-green-900/30'
                              : payment.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30'
                              : payment.status === 'refunded'
                              ? 'bg-gray-100 text-gray-600 dark:bg-gray-800'
                              : 'bg-red-100 text-red-600 dark:bg-red-900/30'
                          }`}
                        >
                          {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
              No payments yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              When you make a purchase, your payment history will appear here.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
