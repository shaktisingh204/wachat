'use client';

import * as React from 'react';
import { ErrorBoundary, FallbackProps } from 'react-error-boundary';

function ItemsErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="flex h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <div className="rounded-full bg-red-100 p-3 text-red-600 dark:bg-red-900/20 dark:text-red-400">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Something went wrong</h2>
      <p className="max-w-md text-sm text-gray-500 dark:text-gray-400">
        We encountered an error loading the inventory items. This could be due to a network timeout or invalid data.
      </p>
      <div className="mt-2 text-xs font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded max-w-lg overflow-auto">
        {error.message}
      </div>
      <button
        onClick={resetErrorBoundary}
        className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Try again
      </button>
    </div>
  );
}

export default function ItemsLayout({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary FallbackComponent={ItemsErrorFallback}>
      {children}
    </ErrorBoundary>
  );
}
