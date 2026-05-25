import * as React from 'react';
import { Loader2 } from 'lucide-react';

export default function BomLoading() {
  return (
    <div className="flex h-[50vh] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-zoru-primary" />
        <p className="text-sm text-zoru-ink-muted">Loading Bill of Materials...</p>
      </div>
    </div>
  );
}
