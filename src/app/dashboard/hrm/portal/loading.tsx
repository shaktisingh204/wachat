import { Loader2 } from 'lucide-react';

export default function PortalLoading() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--st-text-secondary)]" />
            <p className="text-[14px] text-[var(--st-text-secondary)] animate-pulse">Loading portal data...</p>
        </div>
    );
}
