'use client';

import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Label } from '@/components/sabcrm/20ui/compat';
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
    <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 shadow-sm">
      <div className="flex items-center gap-2 text-[12.5px] text-[var(--st-text)]">
        <ListChecks className="h-4 w-4 text-[var(--st-text)]" />
        {count} selected
      </div>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="outline" onClick={onArchive}>
          Archive
        </Button>
        <Button size="sm" variant="outline" onClick={onExportCsv}>
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline">
              Change stage
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {stages.map((s) => (
              <DropdownMenuItem key={s} onSelect={() => onChangeStage(s)}>
                {s}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setAssignUserId(null);
            setAssignOpen(true);
          }}
        >
          Assign to…
        </Button>
        <Button size="sm" variant="destructive" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </Button>
        <Button size="sm" variant="ghost" onClick={onClear} aria-label="Clear selection">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign {count} deal{count === 1 ? '' : 's'}</DialogTitle>
            <DialogDescription>
              Pick an owner. Leave empty to unassign.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Owner</Label>
            <EntityFormField
              entity="user"
              name="_bulk_assign_owner"
              initialId={assignUserId}
              onChange={(next) => setAssignUserId(next)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                onAssign(assignUserId);
                setAssignOpen(false);
              }}
            >
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
