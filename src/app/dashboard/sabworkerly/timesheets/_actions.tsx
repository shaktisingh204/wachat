'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import {
    Button,
    Modal,
    Field,
    Textarea,
    useToast,
} from '@/components/sabcrm/20ui';
import {
    submitSabworkerlyTimesheet,
    approveSabworkerlyTimesheet,
    rejectSabworkerlyTimesheet,
} from '@/app/actions/sabworkerly.actions';

export function TimesheetActions({ id, status }: { id: string; status: string }) {
    const router = useRouter();
    const { toast } = useToast();
    const [pending, startTransition] = useTransition();
    const [rejectOpen, setRejectOpen] = useState(false);
    const [reason, setReason] = useState('');

    const handle = (fn: () => Promise<unknown>, success: string): void => {
        startTransition(async () => {
            try {
                await fn();
                router.refresh();
                toast.success(success);
            } catch {
                toast.error('Something went wrong. Please try again.');
            }
        });
    };

    const confirmReject = (): void => {
        const trimmed = reason.trim();
        handle(() => rejectSabworkerlyTimesheet(id, trimmed || undefined), 'Timesheet rejected');
        setRejectOpen(false);
        setReason('');
    };

    return (
        <div className="flex gap-1">
            {(status === 'draft' || status === 'rejected') && (
                <Button
                    size="sm"
                    variant="secondary"
                    loading={pending}
                    onClick={() => handle(() => submitSabworkerlyTimesheet(id), 'Timesheet submitted')}
                >
                    Submit
                </Button>
            )}
            {status === 'submitted' && (
                <>
                    <Button
                        size="sm"
                        variant="primary"
                        loading={pending}
                        onClick={() => handle(() => approveSabworkerlyTimesheet(id), 'Timesheet approved')}
                    >
                        Approve
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => setRejectOpen(true)}
                    >
                        Reject
                    </Button>

                    <Modal
                        open={rejectOpen}
                        onClose={() => setRejectOpen(false)}
                        title="Reject timesheet"
                        description="Add an optional note so the submitter knows what to change."
                        size="sm"
                        footer={
                            <div className="flex justify-end gap-2">
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setRejectOpen(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    size="sm"
                                    variant="danger"
                                    loading={pending}
                                    onClick={confirmReject}
                                >
                                    Reject
                                </Button>
                            </div>
                        }
                    >
                        <Field label="Rejection reason" help="Optional. Leave blank to reject without a note.">
                            <Textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="Describe what needs to change."
                                rows={4}
                            />
                        </Field>
                    </Modal>
                </>
            )}
        </div>
    );
}
