'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button, Input, Card } from '@/components/ui';

export default function InvitationCodePage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [checking, setChecking] = useState(true);

  // Check if user has already used an invitation code
  useEffect(() => {
    async function checkStatus() {
      try {
        const response = await fetch('/api/user/invitation-status');
        if (response.ok) {
          const data = await response.json() as { hasUsedInvitationCode: boolean };
          if (data.hasUsedInvitationCode) {
            router.push('/dashboard');
            return;
          }
        }
      } catch (error) {
        console.error('Check invitation status error:', error);
      } finally {
        setChecking(false);
      }
    }
    checkStatus();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/user/use-invitation-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      const data = await response.json() as { error?: string; message?: string };

      if (!response.ok) {
        setErrorMessage(data.error || 'Failed to use invitation code');
        return;
      }

      // Success - redirect to dashboard
      router.push('/dashboard');
      router.refresh();
    } catch {
      setErrorMessage('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary-50 to-white dark:from-dark-950 dark:to-dark-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Checking...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary-50 to-white dark:from-dark-950 dark:to-dark-900">
      <div className="w-full max-w-md">
        <Card className="p-8">
          <div className="text-center mb-6">
            <Link href="/" className="inline-block mb-4">
              <Image
                src="/logo.svg"
                alt="Rebebuca"
                width={120}
                height={40}
                className="dark:hidden"
              />
              <Image
                src="/logo-dark.svg"
                alt="Rebebuca"
                width={120}
                height={40}
                className="hidden dark:block"
              />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Enter Invitation Code
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Please enter your invitation code to continue
            </p>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Invitation Code
              </label>
              <Input
                id="code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, '-'))}
                placeholder="ABC-DEF-GHI"
                required
                disabled={loading}
                className="w-full"
                autoFocus
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Format: XXX-XXX-XXX (letters and numbers)
              </p>
            </div>

            <Button
              type="submit"
              disabled={loading || !code.trim()}
              className="w-full"
            >
              {loading ? 'Processing...' : 'Continue'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Don&apos;t have an invitation code?{' '}
              <Link href="/dashboard" className="text-primary-600 hover:text-primary-700 font-medium">
                Skip for now
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </main>
  );
}
