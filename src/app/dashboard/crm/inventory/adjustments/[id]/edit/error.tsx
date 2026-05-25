'use client';

import { PageError } from '@/components/crm/page-error';

export default function EditStockAdjustmentError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return <PageError error={error} reset={reset} />;
}
