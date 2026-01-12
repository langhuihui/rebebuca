import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui';

export default async function PaymentsPage() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  // Get all payments
  const { data: payments } = await supabase
    .from('payments')
    .select(`
      *,
      subscription:subscriptions(
        *,
        product:products(name)
      )
    `)
    .eq('user_id', user?.id)
    .order('created_at', { ascending: false });

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
                  const productName = 
                    (payment.subscription as { product?: { name?: string } })?.product?.name ||
                    (payment.metadata as { product_name?: string })?.product_name ||
                    'Subscription';

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
