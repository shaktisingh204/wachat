'use client';

import { useEffect } from 'react';

export default function EmbedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('[EmbedError]', error);
  }, [error]);

  return (
    <main
      style={{
        margin: 0,
        padding: 24,
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        color: '#111',
        background: '#fff',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
      }}
    >
      <div>
        <h1 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#e11d48' }}>
          Unable to load chat
        </h1>
        <p style={{ fontSize: 13, color: '#555', marginBottom: 16 }}>
          {error.message || 'An unexpected error occurred while loading this widget.'}
        </p>
        <button
          onClick={() => reset()}
          style={{
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 500,
            color: '#fff',
            background: '#111827',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </div>
    </main>
  );
}
