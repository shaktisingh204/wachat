'use client';

import { EntityErrorState } from '@/components/crm/entity-error-state';

export default function EditContractError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <EntityErrorState
      title="Failed to load contract editor"
      message={error.message || 'An unexpected error occurred while loading the contract for editing.'}
      retry={reset}
    />
  );
}
