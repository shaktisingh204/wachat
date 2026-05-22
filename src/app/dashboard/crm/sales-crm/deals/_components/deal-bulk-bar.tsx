'use client';

import {
  Button,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Label,
} from '@/components/zoruui';
import {
  Download,
  ListChecks,
  Trash2,
  X } from 'lucide-react';

/**
 * <DealBulkBar> — sticky bulk-action ribbon for the deals list.
 *
 * Extracted from <DealListClient> for size + composition reasons. Wires
 * real server actions for archive / delete / assign / change-stage; the
 * parent owns confirmation flows for destructive operations.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';

interface DealBulkBarProps {
  count: number;
  stages: string[];
  onExportCsv: () => void;
  onClear: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onChangeStage: (stage: string) => void;
  onAssign: (userId: string | null) => void;
}

export function DealBulkBar({
  count,
  stages,
  onExportCsv,
  onClear,
  onArchive,
  onDelete,
  onChangeStage,
  onAssign,
}: DealBulkBarProps) {
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [assignUserId, setAssignUserId] = React.useState<string | null>(null);

  if (count === 0) return null;

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-zoru-line bg-zoru-surface px-3 py-2 shadow-sm">
      <div className="flex items-center gap-2 text-[12.5px] text-zoru-ink">
        <ListChecks className="h-4 w-4 text-zoru-primary" />
        {count} selected
      </div>
      <div className="flex items-center gap-1">
        <ZoruButton size="sm" variant="outline" onClick={onArchive}>
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
              <ZoruDropdownMenuItem key={s} onSelect={() => onChangeStage(s)}>
                {s}
              </ZoruDropdownMenuItem>
            ))}
          </ZoruDropdownMenuContent>
        </ZoruDropdownMenu>
        <ZoruButton
          size="sm"
          variant="outline"
          onClick={() => {
            setAssignUserId(null);
            setAssignOpen(true);
          }}
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

      <ZoruDialog open={assignOpen} onOpenChange={setAssignOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Assign {count} deal{count === 1 ? '' : 's'}</ZoruDialogTitle>
            <ZoruDialogDescription>
              Pick an owner. Leave empty to unassign.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="space-y-2 py-2">
            <ZoruLabel>Owner</ZoruLabel>
            <EntityFormField
              entity="user"
              name="_bulk_assign_owner"
              initialId={assignUserId}
              onChange={(next) => setAssignUserId(next)}
            />
          </div>
          <ZoruDialogFooter>
            <ZoruButton variant="ghost" onClick={() => setAssignOpen(false)}>
              Cancel
            </ZoruButton>
            <ZoruButton
              onClick={() => {
                onAssign(assignUserId);
                setAssignOpen(false);
              }}
            >
              Assign
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>
    </div>
  );
}
