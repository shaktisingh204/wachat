import { LoaderCircle } from 'lucide-react';
import { Card } from '@/components/zoruui';

export default function ExpiredLoading() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-zoru-bg px-4 text-center">
            <Card className="max-w-md w-full p-8 flex flex-col items-center bg-zoru-surface border border-zoru-line shadow-2xl">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zoru-surface mb-6 shadow-inner animate-pulse">
                    <LoaderCircle className="h-8 w-8 text-zoru-ink-muted animate-spin" />
                </div>

                <div className="h-8 w-48 bg-zoru-surface rounded mb-4 animate-pulse"></div>
                <div className="h-4 w-64 bg-zoru-surface rounded mb-2 animate-pulse"></div>
                <div className="h-4 w-56 bg-zoru-surface rounded mb-8 animate-pulse"></div>

                <div className="w-full pt-4 border-t border-zoru-line">
                    <div className="h-10 w-full bg-zoru-surface rounded animate-pulse"></div>
                </div>
            </Card>
        </div>
    );
}
