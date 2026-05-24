import React from 'react';
import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex items-center justify-center h-[calc(100vh-8rem)] w-full rounded-xl border border-zoru-line bg-zoru-surface">
      <div className="flex flex-col items-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-sm text-zoru-ink-muted">Loading Universal Inbox...</p>
      </div>
    </div>
  );
}
