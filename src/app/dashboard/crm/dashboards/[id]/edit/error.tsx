'use client';

import { EntityError } from '@/components/crm/entity-error';

export default function EditDashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return <EntityError error={error} reset={reset} entityName="Dashboard" />;
}
