'use client';

import { Workflow } from 'lucide-react';

import { EmptyState } from '@/components/sabcrm/20ui';

export function EmptyFlowFallback() {
  return (
    <div className="p-6">
      <EmptyState
        size="sm"
        icon={Workflow}
        title="No flow connected"
        description="This widget does not have a flow connected to it yet."
      />
    </div>
  );
}
