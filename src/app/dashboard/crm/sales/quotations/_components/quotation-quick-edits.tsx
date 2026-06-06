'use client';

import {
  Button,
  Dialog,
  ZoruDialogContent,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  Label,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  useRouter } from 'next/navigation';

/**
 * <QuotationQuickEdits> — inline owner/status chips on the quotation
 * detail "At a glance" card. Status chip changes the quotation status
 * via `updateQuotationStatus`; owner chip opens a small dialog and
 * patches the quotation via the same canonical update endpoint.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import {
  updateQuotation,
  updateQuotationStatus,
} from '@/app/actions/crm/quotations.actions';
import type { CrmQuotationStatus } from '@/lib/rust-client/crm-quotations';

const STATUS_OPTIONS: CrmQuotationStatus[] = [
  'draft',
  'sent',
  'accepted',
  'rejected',
  'expired',
  'converted',
];

interface QuotationQuickEditsProps {
  quotationId: string;
  salesAgentId: string | null;
  status: string;
}

export function QuotationQuickEdits({
  quotationId,
  salesAgentId,
  status,
}: QuotationQuickEditsProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [currentStatus, setCurrentStatus] = React.useState(status);
  const [currentAgent, setCurrentAgent] = React.useState<string | null>(salesAgentId);
  const [agentDialogOpen, setAgentDialogOpen] = React.useState(false);
  const [draftAgent, setDraftAgent] = React.useState<string | null>(salesAgentId);

  React.useEffect(() => setCurrentStatus(status), [status]);
  React.useEffect(() => setCurrentAgent(salesAgentId), [salesAgentId]);

  const changeStatus = (next: CrmQuotationStatus) => {
    if (next === currentStatus) return;
    const prev = currentStatus;
    setCurrentStatus(next);
    updateQuotationStatus(quotationId, next).then((res) => {
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

  const commitAgent = async () => {
    const prev = currentAgent;
    setCurrentAgent(draftAgent);
    setAgentDialogOpen(false);
    try {
      await updateQuotation(quotationId, { salesAgentId: draftAgent ?? undefined } as Parameters<typeof updateQuotation>[1]);
      toast({ title: 'Sales agent updated' });
      router.refresh();
    } catch (e) {
      setCurrentAgent(prev);
      const description = e instanceof Error ? e.message : 'Unknown error';
      toast({ title: 'Agent change failed', description, variant: 'destructive' });
    }
  };

  return (
    <>
      <dl className="space-y-2 text-[12.5px]">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-zoru-ink-muted">Sales agent</dt>
          <dd>
            <button
              type="button"
              className="rounded transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-zoru-primary"
              onClick={() => {
                setDraftAgent(currentAgent);
                setAgentDialogOpen(true);
              }}
              aria-label="Change sales agent"
            >
              {currentAgent ? (
                <EntityPickerChip entity="user" id={currentAgent} />
              ) : (
                <span className="text-zoru-ink-muted underline-offset-2 hover:underline">
                  — assign agent
                </span>
              )}
            </button>
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

      <Dialog open={agentDialogOpen} onOpenChange={setAgentDialogOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Change sales agent</ZoruDialogTitle>
          </ZoruDialogHeader>
          <div className="space-y-2 py-2">
            <Label>Sales agent</Label>
            <EntityFormField
              entity="user"
              name="_agent"
              initialId={draftAgent}
              onChange={(next) => setDraftAgent(next)}
            />
          </div>
          <ZoruDialogFooter>
            <Button variant="ghost" onClick={() => setAgentDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void commitAgent()}>Save</Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </>
  );
}
