'use client';

import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Label, useToast } from '@/components/sabcrm/20ui/compat';
import {
  useRouter } from 'next/navigation';

/**
 * <DealQuickEdits> — inline owner/stage/status chips on the deal detail
 * "At a glance" card. Each chip opens a small popover, mutates via
 * `updateCrmDeal` / `updateCrmDealStage`, and refreshes the page.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { updateCrmDeal, updateCrmDealStage } from '@/app/actions/crm-deals.actions';

const STATUS_OPTIONS = ['open', 'won', 'lost', 'archived'] as const;
type StatusOption = (typeof STATUS_OPTIONS)[number];

interface DealQuickEditsProps {
  dealId: string;
  ownerId: string | null;
  stage: string;
  status?: string | null;
  stages: string[];
}

export function DealQuickEdits({ dealId, ownerId, stage, status, stages }: DealQuickEditsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [currentStage, setCurrentStage] = React.useState(stage);
  const [currentOwner, setCurrentOwner] = React.useState<string | null>(ownerId);
  const [currentStatus, setCurrentStatus] = React.useState<string>(status ?? 'open');
  const [ownerDialogOpen, setOwnerDialogOpen] = React.useState(false);
  const [draftOwner, setDraftOwner] = React.useState<string | null>(ownerId);

  React.useEffect(() => setCurrentStage(stage), [stage]);
  React.useEffect(() => setCurrentOwner(ownerId), [ownerId]);
  React.useEffect(() => setCurrentStatus(status ?? 'open'), [status]);

  const changeStage = (next: string) => {
    if (next === currentStage) return;
    const prev = currentStage;
    setCurrentStage(next);
    updateCrmDealStage(dealId, next).then((res) => {
      if (!res.success) {
        setCurrentStage(prev);
        toast({ title: 'Stage change failed', description: res.error, variant: 'destructive' });
        return;
      }
      toast({ title: `Now in “${next}”` });
      router.refresh();
    });
  };

  const changeStatus = (next: StatusOption) => {
    if (next === currentStatus) return;
    const prev = currentStatus;
    setCurrentStatus(next);
    updateCrmDeal(dealId, { status: next }).then((res) => {
      if (!res.success) {
        setCurrentStatus(prev);
        toast({ title: 'Status change failed', description: res.error, variant: 'destructive' });
        return;
      }
      toast({ title: `Status set to ${next}` });
      router.refresh();
    });
  };

  const commitOwner = () => {
    const prev = currentOwner;
    setCurrentOwner(draftOwner);
    setOwnerDialogOpen(false);
    updateCrmDeal(dealId, { ownerId: draftOwner }).then((res) => {
      if (!res.success) {
        setCurrentOwner(prev);
        toast({ title: 'Owner change failed', description: res.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Owner updated' });
      router.refresh();
    });
  };

  return (
    <>
      <dl className="space-y-2 text-[12.5px]">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-[var(--st-text-secondary)]">Owner</dt>
          <dd>
            <button
              type="button"
              className="rounded transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-text)]"
              onClick={() => {
                setDraftOwner(currentOwner);
                setOwnerDialogOpen(true);
              }}
              aria-label="Change owner"
            >
              {currentOwner ? (
                <EntityPickerChip entity="user" id={currentOwner} />
              ) : (
                <span className="text-[var(--st-text-secondary)] underline-offset-2 hover:underline">— assign owner</span>
              )}
            </button>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-[var(--st-text-secondary)]">Stage</dt>
          <dd>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="rounded-full transition-opacity hover:opacity-80"
                  aria-label="Change stage"
                >
                  {currentStage ? (
                    <StatusPill label={currentStage} tone={statusToTone(currentStage)} />
                  ) : (
                    '—'
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {stages.map((s) => (
                  <DropdownMenuItem key={s} onSelect={() => changeStage(s)}>
                    {s}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-[var(--st-text-secondary)]">Status</dt>
          <dd>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="rounded-full transition-opacity hover:opacity-80"
                  aria-label="Change status"
                >
                  <StatusPill label={currentStatus} tone={statusToTone(currentStatus)} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {STATUS_OPTIONS.map((s) => (
                  <DropdownMenuItem key={s} onSelect={() => changeStatus(s)}>
                    {s}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </dd>
        </div>
      </dl>

      <Dialog open={ownerDialogOpen} onOpenChange={setOwnerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change deal owner</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Owner</Label>
            <EntityFormField
              entity="user"
              name="_owner"
              initialId={draftOwner}
              onChange={(next) => setDraftOwner(next)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOwnerDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={commitOwner}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
