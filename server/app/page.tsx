import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-br from-primary-50 to-white dark:from-dark-950 dark:to-dark-900">
      <div className="max-w-md w-full text-center">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <Image
            src="/logo.svg"
            alt="Rebebuca Logo"
            width={80}
            height={80}
            className="mb-4"
            priority
          />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary-600 to-accent-400 bg-clip-text text-transparent mb-2">
            Rebebuca
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Terminal Task Manager
          </p>
        </div>

        {/* Main Actions */}
        <div className="space-y-4">
          <Link
            href="/login"
            className="block w-full py-3 px-6 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-all shadow-lg shadow-primary-600/25 hover:shadow-primary-600/40"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="block w-full py-3 px-6 bg-white dark:bg-dark-800 hover:bg-gray-50 dark:hover:bg-dark-700 text-gray-900 dark:text-white font-medium rounded-lg border border-gray-200 dark:border-dark-600 transition-colors"
          >
            Create Account
          </Link>
        </div>

        {/* Features */}
        <div className="mt-12 grid grid-cols-1 gap-4 text-left">
          <div className="p-4 bg-white dark:bg-dark-800 rounded-lg border border-gray-200 dark:border-dark-600 hover:border-primary-300 dark:hover:border-primary-700 transition-colors">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
              Subscription Management
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              View and manage your active subscriptions
            </p>
          </div>
          <div className="p-4 bg-white dark:bg-dark-800 rounded-lg border border-gray-200 dark:border-dark-600 hover:border-primary-300 dark:hover:border-primary-700 transition-colors">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
              Payment History
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Track all your payments and invoices
            </p>
          </div>
          <div className="p-4 bg-white dark:bg-dark-800 rounded-lg border border-gray-200 dark:border-dark-600 hover:border-primary-300 dark:hover:border-primary-700 transition-colors">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
              License Keys
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Access and manage your license keys
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-8 text-sm text-gray-500 dark:text-gray-500">
          &copy; {new Date().getFullYear()} Rebebuca. All rights reserved.
        </p>
      </div>
    </main>
  );
}
