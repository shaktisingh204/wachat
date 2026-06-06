import { Button } from '@/components/sabcrm/20ui/compat';
import { FileQuestion } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
    return (
        <main className="zoruui flex min-h-screen items-center justify-center bg-zoru-bg p-4 text-center">
            <div className="flex max-w-md flex-col items-center gap-4 rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-surface p-8 shadow-sm">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zoru-bg">
                    <FileQuestion className="h-8 w-8 text-zoru-ink-muted" />
                </div>
                <h1 className="text-xl font-semibold text-zoru-ink">Share not found</h1>
                <p className="text-sm text-zoru-ink-muted">
                    This shared link doesn't exist or has been removed by the owner.
                </p>
            </div>
        </main>
    );
}
