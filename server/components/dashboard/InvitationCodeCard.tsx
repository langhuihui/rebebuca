'use client';

import { useState } from 'react';

interface InvitationCode {
  id: string;
  code: string;
  used_by_user_id: string | null;
  used_at: string | null;
  created_at: string;
}

interface InvitationCodeCardProps {
  code: InvitationCode;
}

export default function InvitationCodeCard({ code }: InvitationCodeCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-dark-700 rounded-lg border border-gray-200 dark:border-dark-600">
      <div className="flex items-center space-x-4 flex-1">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-1">
            <code className="text-lg font-mono font-bold text-gray-900 dark:text-white bg-white dark:bg-dark-800 px-3 py-1 rounded border border-gray-300 dark:border-dark-600">
              {code.code}
            </code>
            {code.used_by_user_id ? (
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                Used
              </span>
            ) : (
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600 dark:bg-dark-600 dark:text-gray-300">
                Available
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Created: {new Date(code.created_at).toLocaleDateString()}
            {code.used_at && (
              <span className="ml-2">
                • Used: {new Date(code.used_at).toLocaleDateString()}
              </span>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        {!code.used_by_user_id && (
          <button
            onClick={handleCopy}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-600 rounded-lg transition-colors"
            title={copied ? 'Copied!' : 'Copy to clipboard'}
          >
            {copied ? (
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
