'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  Badge,
  Button,
  Card,
  useZoruToast,
} from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';
import { Check,
  Send,
  X } from 'lucide-react';

/**
 * <TimesheetStatusBar /> — submit / approve / reject buttons for a single
 * timesheet record. Uses `ZoruAlertDialog` to confirm approve/reject.
 */

import * as React from 'react';

import {
    setCrmTimesheetStatus,
    type CrmTimesheetStatus,
} from '@/app/actions/crm-timesheets.actions';

interface Props {
    id: string;
    status: CrmTimesheetStatus;
}

const VARIANT_BY_STATUS: Record<CrmTimesheetStatus, 'secondary' | 'warning' | 'success' | 'danger'> = {
    draft: 'secondary',
    submitted: 'warning',
    approved: 'success',
    rejected: 'danger',
    archived: 'secondary',
};

export function TimesheetStatusBar({ id, status }: Props): React.JSX.Element {
    const router = useRouter();
    const { toast } = useZoruToast();
    const [pending, setPending] = React.useState<null | 'submit' | 'approve' | 'reject'>(
        null,
    );
    const [isActing, startAction] = React.useTransition();

    const apply = (next: CrmTimesheetStatus) => {
        startAction(async () => {
            const res = await setCrmTimesheetStatus(id, next);
            if (res.success) {
                toast({ title: `Marked as ${next}` });
                setPending(null);
                router.refresh();
            } else {
                toast({
                    title: 'Error',
                    description: res.error ?? 'Could not update status.',
                    variant: 'destructive',
                });
            }
        });
    };

    return (
        <>
            <ZoruCard className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                    <span className="text-[12px] text-zoru-ink-muted">Status</span>
                    <ZoruBadge variant={VARIANT_BY_STATUS[status]}>{status}</ZoruBadge>
                </div>
                <div className="flex flex-wrap gap-2">
                    {status === 'draft' ? (
                        <ZoruButton onClick={() => setPending('submit')} disabled={isActing}>
                            <Send className="mr-2 h-4 w-4" /> Submit
                        </ZoruButton>
                    ) : null}
                    {status === 'submitted' ? (
                        <>
                            <ZoruButton onClick={() => setPending('approve')} disabled={isActing}>
                                <Check className="mr-2 h-4 w-4" /> Approve
                            </ZoruButton>
                            <ZoruButton
                                variant="outline"
                                onClick={() => setPending('reject')}
                                disabled={isActing}
                            >
                                <X className="mr-2 h-4 w-4" /> Reject
                            </ZoruButton>
                        </>
                    ) : null}
                </div>
            </ZoruCard>

            <ZoruAlertDialog
                open={pending === 'submit'}
                onOpenChange={(o) => !o && setPending(null)}
            >
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>Submit timesheet?</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            Submitting locks this timesheet from edits until an approver acts on it.
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction onClick={() => apply('submitted')}>
                            Submit
                        </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>

            <ZoruAlertDialog
                open={pending === 'approve'}
                onOpenChange={(o) => !o && setPending(null)}
            >
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>Approve timesheet?</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            Approving counts these hours as billable/payable for the week.
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction onClick={() => apply('approved')}>
                            Approve
                        </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>

            <ZoruAlertDialog
                open={pending === 'reject'}
                onOpenChange={(o) => !o && setPending(null)}
            >
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>Reject timesheet?</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            The submitter will be notified and can re-submit after corrections.
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction onClick={() => apply('rejected')}>
                            Reject
                        </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>
        </>
    );
}
