'use client';

/**
 * <PayrollRunActions> — three lifecycle buttons on the detail page.
 *
 * Each button maps to one Rust workflow endpoint:
 * - **Compute** — legal only when status is `draft` or `processing`.
 * - **Approve** — legal only when status is `draft` or `approved`;
 *   requires picking an approver (rendered as `<EntityPicker entity="user">`).
 * - **Disburse** — legal only when status is `approved` and no bank
 *   file has been generated yet.
 *
 * The Rust handlers also enforce these guards; the client-side disabled
 * state is purely UX so the operator doesn't burn a round-trip on an
 * obviously illegal transition.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Calculator, Check, Banknote, LoaderCircle } from 'lucide-react';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruButton,
  ZoruInput,
  ZoruLabel,
  useZoruToast,
} from '@/components/zoruui';
import { EntityFormField } from '@/components/crm/entity-form-field';
import {
  approvePayrollRunAction,
  computePayrollRunAction,
  disbursePayrollRunAction,
} from '@/app/actions/crm/payroll-runs.actions';
import type {
  CrmPayrollRunDoc,
  CrmPayrollRunStatus,
} from '@/lib/rust-client/crm-payroll-runs';

interface PayrollRunActionsProps {
  run: CrmPayrollRunDoc;
}

function canCompute(status?: CrmPayrollRunStatus): boolean {
  return status === 'draft' || status === 'processing';
}
function canApprove(status?: CrmPayrollRunStatus): boolean {
  // The Rust handler also accepts `approved` (multi-step chain), but the
  // single-signer model flips on the first call, so further approvals
  // are a no-op UI-wise — gate the button on `draft` only.
  return status === 'draft';
}
function canDisburse(
  status: CrmPayrollRunStatus | undefined,
  bankFileId: string | undefined,
): boolean {
  return status === 'approved' && !bankFileId;
}

export function PayrollRunActions({ run }: PayrollRunActionsProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [pending, startTransition] = React.useTransition();
  const [approveOpen, setApproveOpen] = React.useState(false);
  const [approverId, setApproverId] = React.useState<string>('');
  const [approverComment, setApproverComment] = React.useState<string>('');

  const id = String(run._id);
  const status = run.status;

  const onCompute = React.useCallback(() => {
    startTransition(async () => {
      const res = await computePayrollRunAction(id);
      if (res.success) {
        toast({ title: 'Computed', description: res.message });
        router.refresh();
      } else {
        toast({
          title: 'Compute failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  }, [id, router, toast]);

  const onApprove = React.useCallback(() => {
    if (!approverId) {
      toast({
        title: 'Approver required',
        description: 'Pick an approver before signing off.',
        variant: 'destructive',
      });
      return;
    }
    startTransition(async () => {
      const res = await approvePayrollRunAction(id, {
        approverId,
        comment: approverComment.trim() || undefined,
      });
      if (res.success) {
        toast({ title: 'Approved', description: res.message });
        setApproveOpen(false);
        setApproverComment('');
        router.refresh();
      } else {
        toast({
          title: 'Approve failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  }, [id, approverId, approverComment, router, toast]);

  const onDisburse = React.useCallback(() => {
    startTransition(async () => {
      const res = await disbursePayrollRunAction(id);
      if (res.success) {
        toast({ title: 'Disbursed', description: res.message });
        router.refresh();
      } else {
        toast({
          title: 'Disburse failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  }, [id, router, toast]);

  const computeDisabled = pending || !canCompute(status);
  const approveDisabled = pending || !canApprove(status);
  const disburseDisabled = pending || !canDisburse(status, run.bankFileId);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <ZoruButton
          variant="outline"
          onClick={onCompute}
          disabled={computeDisabled}
          title={
            canCompute(status)
              ? 'Resolve employees and compute totals'
              : `Compute is only legal in draft or processing (current: ${status ?? 'unknown'})`
          }
        >
          {pending ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Calculator className="h-4 w-4" />
          )}
          Compute
        </ZoruButton>
        <ZoruButton
          variant="outline"
          onClick={() => setApproveOpen(true)}
          disabled={approveDisabled}
          title={
            canApprove(status)
              ? 'Sign off on this run'
              : `Approve is only legal in draft (current: ${status ?? 'unknown'})`
          }
        >
          <Check className="h-4 w-4" />
          Approve
        </ZoruButton>
        <ZoruButton
          onClick={onDisburse}
          disabled={disburseDisabled}
          title={
            canDisburse(status, run.bankFileId)
              ? 'Generate the bank file and disburse'
              : run.bankFileId
                ? 'A bank file already exists for this run.'
                : `Disburse requires an approved run (current: ${status ?? 'unknown'})`
          }
        >
          {pending ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Banknote className="h-4 w-4" />
          )}
          Disburse
        </ZoruButton>
      </div>

      <ZoruAlertDialog
        open={approveOpen}
        onOpenChange={(o) => !o && setApproveOpen(false)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Approve payroll run</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              Append an approval step. With the single-signer rule active,
              this flips the run to <strong>approved</strong> and unlocks
              disbursal.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <div className="space-y-4 px-1">
            <div>
              <ZoruLabel>Approver</ZoruLabel>
              <div className="mt-1.5">
                <EntityFormField
                  entity="user"
                  name="approverId"
                  initialId={approverId || null}
                  onChange={(next) => setApproverId(next ?? '')}
                />
              </div>
            </div>
            <div>
              <ZoruLabel htmlFor="approverComment">Comment</ZoruLabel>
              <ZoruInput
                id="approverComment"
                value={approverComment}
                onChange={(e) => setApproverComment(e.target.value)}
                placeholder="LGTM"
                className="mt-1.5"
              />
            </div>
          </div>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel disabled={pending}>
              Cancel
            </ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                onApprove();
              }}
              disabled={pending || !approverId}
            >
              {pending ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Sign off
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </>
  );
}
