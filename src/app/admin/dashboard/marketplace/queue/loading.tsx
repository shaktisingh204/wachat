import { Loader2 } from 'lucide-react';
import { ShieldCheck } from 'lucide-react';

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-amber-600 mb-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            Admin · SabFlow Marketplace
          </div>
          <h1 className="text-2xl font-bold text-zoru-ink">Review Queue</h1>
          <p className="text-sm text-zoru-ink-muted mt-1">Loading review queue...</p>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    </div>
  );
}
