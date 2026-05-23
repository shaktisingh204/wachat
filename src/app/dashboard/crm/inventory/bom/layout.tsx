'use client';

import React from 'react';
import { ErrorBoundary } from 'react-error-boundary';

function Fallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="p-4 rounded-md bg-red-50 dark:bg-red-950 text-red-900 dark:text-red-200">
      <h2 className="text-lg font-bold">Something went wrong in the BOM module</h2>
      <pre className="text-sm mt-2 mb-4">{error.message}</pre>
      <button
        onClick={resetErrorBoundary}
        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
      >
        Try again
      </button>
    </div>
  );
}

export default function BomLayout({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary FallbackComponent={Fallback}>
      {children}
    </ErrorBoundary>
  );
}
