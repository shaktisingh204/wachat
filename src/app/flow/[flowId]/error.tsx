'use client';

import { useEffect } from 'react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Optionally log the error to an error reporting service
    console.error('Flow Page Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--gray-2)] p-6">
      <div className="flex flex-col items-center gap-4 text-center max-w-sm bg-white p-8 rounded-2xl shadow-xl">
        <div className="h-12 w-12 rounded-full bg-[var(--st-bg-muted)] flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[var(--st-text)]"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 className="text-[18px] font-semibold text-[var(--gray-12)]">
          Something went wrong
        </h2>
        <p className="text-[14px] text-[var(--gray-9)] leading-relaxed">
          We encountered an error while trying to load this flow. Please try again later.
        </p>
        <button
          onClick={() => reset()}
          className="mt-4 px-4 py-2 bg-[var(--orange-8)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
