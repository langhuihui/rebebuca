export const runtime = 'edge';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui';
import Link from 'next/link';
import { verifyToken } from '@/lib/auth/jwt';
import { getDB, User, Subscription, Payment, InvitationCode } from '@/lib/db';
import InvitationCodeCard from '@/components/dashboard/InvitationCodeCard';


export default async function DashboardPage() {
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

  // Get active subscription
  const activeSubscription = await db.prepare(`
    SELECT s.*, p.name as product_name, p.features as product_features
    FROM subscriptions s
    LEFT JOIN products p ON s.product_id = p.id
    WHERE s.user_id = ? AND s.status = 'active'
    ORDER BY s.created_at DESC
    LIMIT 1
  `).bind(user.id).first<Subscription & { product_name: string; product_features: string }>();

  // Get recent payments
  const { results: recentPayments } = await db.prepare(`
    SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 3
  `).bind(user.id).all<Payment>();

  // Get user's invitation codes
  const { results: invitationCodes } = await db.prepare(`
    SELECT * FROM invitation_codes
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).bind(user.id).all<InvitationCode>();

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Welcome back, {user.display_name || user.email.split('@')[0]}!
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Here&apos;s an overview of your account.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Current Plan */}
        <Card>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Current Plan
            </h3>
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
              activeSubscription?.plan_type === 'pro'
                ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30'
                : activeSubscription?.plan_type === 'enterprise'
                ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30'
                : 'bg-gray-100 text-gray-600 dark:bg-dark-700 dark:text-gray-300'
            }`}>
              {activeSubscription?.status || 'Active'}
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white capitalize">
            {activeSubscription?.plan_type || 'Free'}
          </p>
          {activeSubscription?.expires_at && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Expires: {new Date(activeSubscription.expires_at).toLocaleDateString()}
            </p>
          )}
        </Card>

        {/* Account Status */}
        <Card>
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
            Account Status
          </h3>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              Active
            </p>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Member since {new Date(user.created_at).toLocaleDateString()}
          </p>
        </Card>

        {/* Quick Actions */}
        <Card>
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
            Quick Actions
          </h3>
          <div className="space-y-2">
            <Link
              href="/dashboard/subscriptions"
              className="block w-full text-center py-2 px-4 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {activeSubscription?.plan_type === 'free' || !activeSubscription ? 'Upgrade Plan' : 'Manage Plan'}
            </Link>
            <Link
              href="/dashboard/settings"
              className="block w-full text-center py-2 px-4 border border-gray-300 dark:border-dark-600 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors"
            >
              Account Settings
            </Link>
          </div>
        </Card>
      </div>

      {/* Invitation Codes */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              My Invitation Codes
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Share these codes with others to invite them to join
            </p>
          </div>
        </div>

        {invitationCodes && invitationCodes.length > 0 ? (
          <div className="space-y-3">
            {invitationCodes.map((code: InvitationCode) => (
              <InvitationCodeCard key={code.id} code={code} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            <p>No invitation codes yet</p>
          </div>
        )}
      </Card>

      {/* Recent Activity */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Recent Payments
          </h2>
          <Link
            href="/dashboard/payments"
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            View all
          </Link>
        </div>

        {recentPayments && recentPayments.length > 0 ? (
          <div className="space-y-3">
            {recentPayments.map((payment: Payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-700 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    payment.status === 'completed'
                      ? 'bg-green-100 dark:bg-green-900/30'
                      : payment.status === 'pending'
                      ? 'bg-yellow-100 dark:bg-yellow-900/30'
                      : 'bg-red-100 dark:bg-red-900/30'
                  }`}>
                    {payment.status === 'completed' ? (
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : payment.status === 'pending' ? (
                      <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {payment.payment_method.charAt(0).toUpperCase() + payment.payment_method.slice(1)} Payment
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(payment.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    ${payment.amount.toFixed(2)} {payment.currency}
                  </p>
                  <p className={`text-xs capitalize ${
                    payment.status === 'completed' ? 'text-green-600' :
                    payment.status === 'pending' ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {payment.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p>No payment history yet</p>
          </div>
        )}
      </Card>
    </div>
  );
}
