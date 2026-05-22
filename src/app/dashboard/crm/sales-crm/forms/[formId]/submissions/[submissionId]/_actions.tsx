'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
    Archive,
    CheckCircle2,
    ShieldAlert,
    Trash2,
    UserPlus,
    Briefcase,
} from 'lucide-react';

import { Button, useZoruToast } from '@/components/zoruui';
import {
    updateSubmissionStatus,
    deleteSubmission,
    convertSubmissionToContact,
    convertSubmissionToLead,
} from '@/app/actions/crm-forms.actions';

type StatusValue = 'new' | 'processed' | 'spam' | 'archived';

export interface SubmissionDetailActionsProps {
    submissionId: string;
    formId: string;
}

export function SubmissionDetailActions({
    submissionId,
    formId,
}: SubmissionDetailActionsProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const [pending, startTransition] = React.useTransition();

    const setStatus = (status: StatusValue) => {
        startTransition(async () => {
            const res = await updateSubmissionStatus(submissionId, status);
            if (res.success) {
                toast({ title: 'Status updated', description: `Marked as ${status}.` });
                router.refresh();
            } else {
                toast({
                    title: 'Update failed',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        });
    };

    const onDelete = () => {
        if (!confirm('Delete this submission? This cannot be undone.')) return;
        startTransition(async () => {
            const res = await deleteSubmission(submissionId);
            if (res.success) {
                toast({ title: 'Submission deleted' });
                router.push(`/dashboard/crm/sales-crm/forms/${formId}/submissions`);
            } else {
                toast({
                    title: 'Delete failed',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        });
    };

    const onConvertContact = () => {
        startTransition(async () => {
            const res = await convertSubmissionToContact(submissionId);
            if (res.success) {
                toast({ title: 'Contact created' });
                router.refresh();
            } else {
                toast({
                    title: 'Could not create contact',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        });
    };

    const onConvertLead = () => {
        startTransition(async () => {
            const res = await convertSubmissionToLead(submissionId);
            if (res.success) {
                toast({ title: 'Lead created' });
                router.refresh();
            } else {
                toast({
                    title: 'Could not create lead',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        });
    };

    return (
        <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setStatus('processed')} disabled={pending}>
                <CheckCircle2 className="h-3.5 w-3.5" /> Mark processed
            </Button>
            <Button size="sm" variant="outline" onClick={() => setStatus('spam')} disabled={pending}>
                <ShieldAlert className="h-3.5 w-3.5" /> Spam
            </Button>
            <Button size="sm" variant="outline" onClick={() => setStatus('archived')} disabled={pending}>
                <Archive className="h-3.5 w-3.5" /> Archive
            </Button>
            <Button size="sm" variant="default" onClick={onConvertContact} disabled={pending}>
                <UserPlus className="h-3.5 w-3.5" /> Convert to contact
            </Button>
            <Button size="sm" variant="default" onClick={onConvertLead} disabled={pending}>
                <Briefcase className="h-3.5 w-3.5" /> Convert to lead
            </Button>
            <Button size="sm" variant="destructive" onClick={onDelete} disabled={pending}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
        </div>
    );
}
