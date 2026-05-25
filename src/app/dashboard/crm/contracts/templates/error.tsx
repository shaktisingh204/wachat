'use client';

import { useEffect } from 'react';
import { ErrorBoundaryShell } from '@/components/crm/error-boundary-shell';

export default function TemplatesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErrorBoundaryShell error={error} reset={reset} />;
}
