'use client';

import React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { LayoutGrid, List, Table2 } from 'lucide-react';

import { SegmentedControl } from '@/components/sabcrm/20ui';
import type { SabPipelineSummary, SabView } from '@/components/sabbigin/lib/types';

const VIEW_ITEMS = [
  { value: 'board', label: 'Board', icon: <LayoutGrid size={14} /> },
  { value: 'list', label: 'List', icon: <List size={14} /> },
  { value: 'sheet', label: 'Sheet', icon: <Table2 size={14} /> },
];

export function DealsToolbar({
  pipelines,
  activePipelineId,
  view,
}: {
  pipelines: SabPipelineSummary[];
  activePipelineId: string | null;
  view: SabView;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  function navigate(next: Record<string, string>) {
    const params = new URLSearchParams(search.toString());
    for (const [k, v] of Object.entries(next)) params.set(k, v);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-[var(--st-text-secondary)]">
          Pipeline
        </label>
        <select
          className="u-input u-input--sm min-w-[180px]"
          value={activePipelineId ?? ''}
          onChange={(e) => navigate({ pipeline: e.target.value })}
        >
          {pipelines.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <SegmentedControl
        items={VIEW_ITEMS as any}
        value={view}
        onChange={(v) => navigate({ view: v as string })}
        size="sm"
      />
    </div>
  );
}
