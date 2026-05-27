import { Loader2 } from 'lucide-react';

export default function ShareLoading() {
    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-zoru-ink-muted" />
            <p className="mt-4 text-sm font-medium text-zoru-ink">Loading...</p>
        </div>
    );
}
