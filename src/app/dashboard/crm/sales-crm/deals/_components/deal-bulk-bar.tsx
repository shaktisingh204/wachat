'use client';

/**
 * <DealBulkBar> — sticky bulk-action ribbon for the deals list.
 *
 * Extracted from <DealListClient> for size + composition reasons. Stays
 * cleanly under the 600-line cap from the rebuild plan. Stub-action
 * toasts mirror their callsite-language until the dual-impl endpoints
 * land (see CRM_REBUILD_PLAN §3).
 */

import * as React from 'react';
import { Download, ListChecks, Trash2, X } from 'lucide-react';

import {
  ZoruButton,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  useZoruToast,
} from '@/components/zoruui';

interface DealBulkBarProps {
  count: number;
  stages: string[];
  onExportCsv: () => void;
  onClear: () => void;
  onDelete: () => void;
}

export function DealBulkBar({
  count,
  stages,
  onExportCsv,
  onClear,
  onDelete,
}: DealBulkBarProps) {
  const { toast } = useZoruToast();
  if (count === 0) return null;
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-zoru-line bg-zoru-surface px-3 py-2 shadow-sm">
      <div className="flex items-center gap-2 text-[12.5px] text-zoru-ink">
        <ListChecks className="h-4 w-4 text-zoru-primary" />
        {count} selected
      </div>
      <div className="flex items-center gap-1">
        <ZoruButton
          size="sm"
          variant="outline"
          onClick={() =>
            toast({
              title: 'Coming soon',
              description: 'Bulk archive will land with the dual-impl sweep.',
            })
          }
        >
          Archive
        </ZoruButton>
        <ZoruButton size="sm" variant="outline" onClick={onExportCsv}>
          <Download className="h-3.5 w-3.5" /> Export CSV
        </ZoruButton>
        <ZoruDropdownMenu>
          <ZoruDropdownMenuTrigger asChild>
            <ZoruButton size="sm" variant="outline">
              Change stage
            </ZoruButton>
          </ZoruDropdownMenuTrigger>
          <ZoruDropdownMenuContent>
            {stages.map((s) => (
              <ZoruDropdownMenuItem
                key={s}
                onSelect={() =>
                  toast({
                    title: 'Use the kanban view',
                    description: `Drag cards to "${s}" — bulk stage-change endpoint is in flight.`,
                  })
                }
              >
                {s}
              </ZoruDropdownMenuItem>
            ))}
          </ZoruDropdownMenuContent>
        </ZoruDropdownMenu>
        <ZoruButton
          size="sm"
          variant="outline"
          onClick={() =>
            toast({
              title: 'Coming soon',
              description: 'Bulk assign-to ships with the team-perms cleanup.',
            })
          }
        >
          Assign to…
        </ZoruButton>
        <ZoruButton size="sm" variant="destructive" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </ZoruButton>
        <ZoruButton size="sm" variant="ghost" onClick={onClear} aria-label="Clear selection">
          <X className="h-3.5 w-3.5" />
        </ZoruButton>
      </div>
    </div>
  );
}
