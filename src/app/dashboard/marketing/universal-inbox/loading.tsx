import React from 'react';
import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex items-center justify-center h-[calc(100vh-8rem)] w-full rounded-xl border border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
      <div className="flex flex-col items-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--st-text)]" />
        <p className="text-sm text-[var(--st-text-secondary)]">Loading Universal Inbox...</p>
      </div>
    </div>
  );
}
