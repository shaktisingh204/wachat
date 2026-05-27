'use client';

import { useEffect } from 'react';

export default function BlogError({
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
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8">
      <h2 className="text-2xl font-bold mb-4 font-sans">Something went wrong!</h2>
      <p className="text-neutral-400 font-mono text-sm mb-8 max-w-md text-center">
        We encountered an error while loading the changelog content.
      </p>
      <button
        onClick={() => reset()}
        className="px-4 py-2 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 transition-colors rounded text-sm font-mono"
      >
        Try again
      </button>
    </div>
  );
}
