'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Badge, Button, Card, useToast } from '@/components/sabcrm/20ui/compat';
import {
  useRouter } from 'next/navigation';
import { Check,
  Send,
  X } from 'lucide-react';

/**
 * <TimesheetStatusBar /> — submit / approve / reject buttons for a single
 * timesheet record. Uses `AlertDialog` to confirm approve/reject.
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
    const { toast } = useToast();
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
            <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                    <span className="text-[12px] text-[var(--st-text-secondary)]">Status</span>
                    <Badge variant={VARIANT_BY_STATUS[status]}>{status}</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                    {status === 'draft' ? (
                        <Button onClick={() => setPending('submit')} disabled={isActing}>
                            <Send className="mr-2 h-4 w-4" /> Submit
                        </Button>
                    ) : null}
                    {status === 'submitted' ? (
                        <>
                            <Button onClick={() => setPending('approve')} disabled={isActing}>
                                <Check className="mr-2 h-4 w-4" /> Approve
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setPending('reject')}
                                disabled={isActing}
                            >
                                <X className="mr-2 h-4 w-4" /> Reject
                            </Button>
                        </>
                    ) : null}
                </div>
            </Card>

            <AlertDialog
                open={pending === 'submit'}
                onOpenChange={(o) => !o && setPending(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Submit timesheet?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Submitting locks this timesheet from edits until an approver acts on it.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => apply('submitted')}>
                            Submit
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
                open={pending === 'approve'}
                onOpenChange={(o) => !o && setPending(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Approve timesheet?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Approving counts these hours as billable/payable for the week.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => apply('approved')}>
                            Approve
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
                open={pending === 'reject'}
                onOpenChange={(o) => !o && setPending(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reject timesheet?</AlertDialogTitle>
                        <AlertDialogDescription>
                            The submitter will be notified and can re-submit after corrections.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => apply('rejected')}>
                            Reject
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
