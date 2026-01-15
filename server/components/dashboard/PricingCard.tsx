'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button } from '@/components/ui';

interface ProductWithFeatures {
  id: string;
  name: string;
  description: string | null;
  price_usd: number;
  price_cny?: number | null;
  features: string[];
  is_active?: number | boolean;
  created_at: string;
  updated_at: string;
}

interface PricingCardProps {
  product: ProductWithFeatures;
  isCurrentPlan: boolean;
  userId?: string;
}

export default function PricingCard({ product, isCurrentPlan, userId }: PricingCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const features = product.features;
  const isPopular = product.name === 'Pro';
  const isFree = product.price_usd === 0;
  const isPaidPlan = !isFree;

  const handleSubscribe = async () => {
    // Paid plans are coming soon - disabled
    if (isPaidPlan) return;
    
    if (!userId) {
      router.push('/login?redirect=/dashboard/subscriptions');
      return;
    }

    if (isFree || isCurrentPlan) return;

    setLoading(true);
    try {
      const response = await fetch('/api/payment/paypal/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id }),
      });

      const data = await response.json() as { approvalUrl?: string; error?: string };

      if (data.approvalUrl) {
        window.location.href = data.approvalUrl;
      } else {
        console.error('Failed to create order:', data.error);
      }
    } catch (error) {
      console.error('Payment error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      className={`relative ${isPopular ? 'border-2 border-primary-500' : ''} ${
        isCurrentPlan ? 'ring-2 ring-green-500' : ''
      }`}
    >
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="px-3 py-1 text-xs font-medium bg-primary-500 text-white rounded-full">
            Most Popular
          </span>
        </div>
      )}

      {isCurrentPlan && (
        <div className="absolute -top-3 right-4">
          <span className="px-3 py-1 text-xs font-medium bg-green-500 text-white rounded-full">
            Current Plan
          </span>
        </div>
      )}

      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
          {product.name}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {product.description}
        </p>
      </div>

      <div className="text-center mb-6">
        <span className="text-4xl font-bold text-gray-900 dark:text-white">
          ${product.price_usd}
        </span>
        {!isFree && (
          <span className="text-gray-500 dark:text-gray-400">/year</span>
        )}
      </div>

      <ul className="space-y-3 mb-6">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start">
            <svg
              className="w-5 h-5 text-green-500 mr-2 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {String(feature)}
            </span>
          </li>
        ))}
      </ul>

      <Button
        onClick={handleSubscribe}
        variant={isCurrentPlan ? 'secondary' : isPopular ? 'primary' : 'outline'}
        className="w-full"
        disabled={isCurrentPlan || isPaidPlan}
        loading={loading}
      >
        {isCurrentPlan
          ? 'Current Plan'
          : isFree
          ? 'Free'
          : 'Coming Soon'}
      </Button>
    </Card>
  );
}
