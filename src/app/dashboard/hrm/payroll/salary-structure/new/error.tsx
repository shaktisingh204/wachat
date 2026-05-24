'use client';
import { Button } from '@/components/zoruui';
export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center p-12">
            <h2 className="text-lg font-semibold text-zoru-ink">Something went wrong!</h2>
            <p className="mt-2 text-sm text-zoru-ink-muted">{error.message || 'An unexpected error occurred.'}</p>
            <Button onClick={() => reset()} className="mt-4">Try again</Button>
        </div>
    );
}
