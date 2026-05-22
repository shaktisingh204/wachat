'use client';

import { DropdownMenu, ZoruDropdownMenuContent, ZoruDropdownMenuItem, ZoruDropdownMenuTrigger, useZoruToast } from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';

/**
 * <RfqQuickEdits> — inline status chip on the RFQ detail "At a glance"
 * card. Status chip changes the RFQ status via `updateRfqStatus`.
 *
 * Owner is rendered read-only here — the RFQ Rust DTO doesn't yet
 * surface a first-class owner field; the create / edit form remains
 * the canonical place to update it (via the `audit.createdBy` /
 * `audit.updatedBy` chain on the server side).
 */

import * as React from 'react';

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { updateRfqStatus } from '@/app/actions/crm/rfqs.actions';
import type { CrmRfqStatus } from '@/lib/rust-client/crm-rfqs';

const STATUS_OPTIONS: CrmRfqStatus[] = [
  'draft',
  'open',
  'closed',
  'awarded',
  'cancelled',
];

interface RfqQuickEditsProps {
  rfqId: string;
  ownerId: string | null;
  status: string;
}

export function RfqQuickEdits({
  rfqId,
  ownerId,
  status,
}: RfqQuickEditsProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [currentStatus, setCurrentStatus] = React.useState(status);

  React.useEffect(() => setCurrentStatus(status), [status]);

  const changeStatus = (next: CrmRfqStatus) => {
    if (next === currentStatus) return;
    const prev = currentStatus;
    setCurrentStatus(next);
    updateRfqStatus(rfqId, next).then((res) => {
      if (!res.success) {
        setCurrentStatus(prev);
        toast({
          title: 'Status change failed',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }
      toast({ title: `Status set to ${next}` });
      router.refresh();
    });
  };

  return (
    <dl className="space-y-2 text-[12.5px]">
      <div className="flex items-center justify-between gap-2">
        <dt className="text-zoru-ink-muted">Owner</dt>
        <dd>
          {ownerId ? (
            <EntityPickerChip entity="user" id={ownerId} />
          ) : (
            <span className="text-zoru-ink-muted">—</span>
          )}
        </dd>
      </div>

      <div className="flex items-center justify-between gap-2">
        <dt className="text-zoru-ink-muted">Status</dt>
        <dd>
          <DropdownMenu>
            <ZoruDropdownMenuTrigger asChild>
              <button
                type="button"
                className="rounded-full transition-opacity hover:opacity-80"
                aria-label="Change status"
              >
                <StatusPill label={currentStatus} tone={statusToTone(currentStatus)} />
              </button>
            </ZoruDropdownMenuTrigger>
            <ZoruDropdownMenuContent>
              {STATUS_OPTIONS.map((s) => (
                <ZoruDropdownMenuItem key={s} onSelect={() => changeStatus(s)}>
                  {s}
                </ZoruDropdownMenuItem>
              ))}
            </ZoruDropdownMenuContent>
          </DropdownMenu>
        </dd>
      </div>
    </dl>
  );
}
