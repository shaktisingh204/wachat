'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { Card, Button } from '@/components/zoruui';

export default function ExpiredError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-zoru-bg px-4 text-center">
            <Card className="max-w-md w-full p-8 flex flex-col items-center bg-zoru-surface border border-zoru-line shadow-2xl">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zoru-surface mb-6 shadow-inner text-zoru-ink">
                    <AlertCircle className="h-8 w-8" />
                </div>

                <h1 className="text-xl font-semibold text-zoru-ink mb-2">Something went wrong</h1>

                <p className="text-sm text-zoru-ink-muted max-w-sm mb-6">
                    We couldn't load the information for this expired link. Please try again.
                </p>

                <div className="w-full pt-4 border-t border-zoru-line flex flex-col gap-3">
                    <Button onClick={() => reset()} className="w-full">
                        Try again
                    </Button>
                    <Link href="/" className="w-full block">
                        <Button variant="outline" className="w-full">
                            Go to Homepage
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </Link>
                </div>
            </Card>
        </div>
    );
}
