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
    Download,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

import { Button, useToast } from '@/components/sabcrm/20ui/compat';
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
    const { toast } = useToast();
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

    const onExportPDF = async () => {
        const element = document.getElementById('submission-detail-content');
        if (!element) {
            toast({ title: 'Export failed', description: 'Content not found', variant: 'destructive' });
            return;
        }

        startTransition(async () => {
            try {
                const canvas = await html2canvas(element, {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff'
                });
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                
                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                pdf.save(`submission-${submissionId}.pdf`);
            } catch (error) {
                console.error('Error exporting PDF:', error);
                toast({ title: 'Export failed', description: 'An error occurred during export.', variant: 'destructive' });
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
            <Button size="sm" variant="outline" onClick={onExportPDF} disabled={pending}>
                <Download className="h-3.5 w-3.5" /> Export PDF
            </Button>
            <Button size="sm" variant="destructive" onClick={onDelete} disabled={pending}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
        </div>
    );
}
