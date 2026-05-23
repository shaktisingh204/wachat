import React from 'react';
import { ErrorBoundary } from '../error-boundary';

export default function BatchExpiryLayout({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  );
}
