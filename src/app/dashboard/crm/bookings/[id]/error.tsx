'use client';

import { ErrorBoundaryWrapper } from '@/components/crm/error-boundary-wrapper';

export default function BookingDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorBoundaryWrapper
      title="Could not load booking"
      message="We couldn't load the booking details."
      error={error}
      reset={reset}
    />
  );
}
