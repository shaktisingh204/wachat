'use client';
import { Button } from '@/components/sabcrm/20ui/compat';
import { ShieldAlert } from 'lucide-react';

export default function AuditError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="flex h-[400px] flex-col items-center justify-center space-y-4 rounded-2xl border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-6 text-center">
            <ShieldAlert className="h-10 w-10 text-[var(--st-text)]" />
            <div>
                <h2 className="text-lg font-semibold text-[var(--st-text)]">Failed to load audit log</h2>
                <p className="mt-1 text-sm text-[var(--st-text)]">{error.message}</p>
            </div>
            <Button onClick={() => reset()}>
                Try again
            </Button>
        </div>
    );
}
