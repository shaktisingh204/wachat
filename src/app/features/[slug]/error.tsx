'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { FeatureHeader, FeatureFooter } from '@/components/features/FeatureChrome';

export default function FeatureError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="sn-root relative min-h-screen overflow-x-clip antialiased bg-white text-[#121126] flex flex-col">
      <FeatureHeader />
      
      <main className="flex-grow flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-red-50 border border-red-100 rounded-2xl p-8 text-center shadow-lg">
          <div className="mx-auto h-12 w-12 bg-red-100 rounded-full flex items-center justify-center mb-6">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          <h2 className="text-2xl font-display text-red-900 mb-3">Something went wrong!</h2>
          <p className="text-red-700 text-sm mb-8 leading-relaxed">
            We encountered an unexpected error while trying to load this feature page. Please try again or explore our other features.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => reset()}
              className="w-full h-11 bg-red-600 text-white rounded-full font-medium hover:bg-red-700 transition-colors"
            >
              Try again
            </button>
            <Link 
              href="/features"
              className="w-full h-11 flex items-center justify-center bg-white border border-red-200 text-red-700 rounded-full font-medium hover:bg-red-50 transition-colors"
            >
              Browse all features
            </Link>
          </div>
        </div>
      </main>

      <FeatureFooter />
    </div>
  );
}
