import { LoaderCircle } from 'lucide-react';
import { Card } from '@/components/sabcrm/20ui';

export default function ExpiredLoading() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--st-bg)] px-4 text-center">
            <Card className="max-w-md w-full p-8 flex flex-col items-center bg-[var(--st-bg-secondary)] border border-[var(--st-border)] shadow-2xl">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--st-bg-secondary)] mb-6 shadow-inner animate-pulse">
                    <LoaderCircle className="h-8 w-8 text-[var(--st-text-secondary)] animate-spin" />
                </div>

                <div className="h-8 w-48 bg-[var(--st-bg-secondary)] rounded mb-4 animate-pulse"></div>
                <div className="h-4 w-64 bg-[var(--st-bg-secondary)] rounded mb-2 animate-pulse"></div>
                <div className="h-4 w-56 bg-[var(--st-bg-secondary)] rounded mb-8 animate-pulse"></div>

                <div className="w-full pt-4 border-t border-[var(--st-border)]">
                    <div className="h-10 w-full bg-[var(--st-bg-secondary)] rounded animate-pulse"></div>
                </div>
            </Card>
        </div>
    );
}
