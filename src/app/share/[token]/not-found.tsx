import { Button } from '@/components/sabcrm/20ui';
import { FileQuestion } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
    return (
        <main className="zoruui flex min-h-screen items-center justify-center bg-[var(--st-bg)] p-4 text-center">
            <div className="flex max-w-md flex-col items-center gap-4 rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-8 shadow-sm">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--st-bg)]">
                    <FileQuestion className="h-8 w-8 text-[var(--st-text-secondary)]" />
                </div>
                <h1 className="text-xl font-semibold text-[var(--st-text)]">Share not found</h1>
                <p className="text-sm text-[var(--st-text-secondary)]">
                    This shared link doesn't exist or has been removed by the owner.
                </p>
            </div>
        </main>
    );
}
