'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, useZoruToast } from '@/components/sabcrm/20ui/compat';
import { ArrowLeft, LoaderCircle, Save } from 'lucide-react';
import Link from 'next/link';
import { LiveSidebar } from './live-sidebar';
import { LiveCanvas } from './live-canvas';
import {
    getSeedTemplate,
    getFieldAliases,
    getDocumentLabel,
} from './seed-templates';

export type DocumentType =
    // sales
    | 'proposal'
    | 'estimate'
    | 'quotation'
    | 'invoice'
    | 'delivery'
    | 'order'
    | 'proforma'
    | 'credit_note'
    // crm
    | 'contract'
    | 'service_contract'
    | 'purchase_order'
    | 'expense_report'
    | 'payout'
    | 'debit_note'
    // hrm
    | 'offer_letter'
    | 'exit_letter'
    | 'award'
    | 'certification'
    | 'expense_claim'
    | 'travel_request'
    | 'disciplinary_letter'
    | 'notice'
    | 'announcement'
    | 'feedback_360'
    | 'probation_letter'
    | 'recognition'
    | 'policy'
    | 'document_template';

export interface LiveDocumentEditorProps {
    documentType: DocumentType;
    initialData?: Record<string, any> | null;
    saveAction: (prevState: any, formData: FormData) => Promise<{ message?: string; error?: string; id?: string }>;
    backHref: string;
    /**
     * Extra FormData fields to send with every save (e.g. parentType / parentId
     * from the URL query) so the server action can wire the document to its
     * owning record. Each entry is appended verbatim.
     */
    extraFormData?: Record<string, string>;
}

export function LiveDocumentEditor({
    documentType,
    initialData,
    saveAction,
    backHref,
    extraFormData,
}: LiveDocumentEditorProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;
    const [isPending, startTransition] = useTransition();

    const [docState, setDocState] = useState(() => {
        const seed = getSeedTemplate(documentType);
        // Hydrate from initialData. Where a field is missing, fall back to the
        // type's seed so the New page opens 80% drafted, not blank.
        return {
            title: initialData?.title ?? seed.title,
            accountId: initialData?.accountId ?? '',
            employeeId: initialData?.employeeId ?? '',
            candidateId: initialData?.candidateId ?? '',
            vendorId: initialData?.vendorId ?? '',
            status: initialData?.status ?? seed.status ?? 'draft',
            currency: initialData?.currency ?? seed.currency ?? 'INR',
            totalAmount: initialData?.totalAmount ?? 0,
            validUntil: initialData?.validUntil ?? '',
            sections: initialData?.sections ?? seed.sections,
            lineItems: initialData?.lineItems ?? seed.lineItems ?? [],
            attachments: initialData?.attachments ?? [],
            designMetadata: {
                themeColor: '#0f172a',
                fontFamily: 'Inter',
                showLogo: true,
                showWatermark: false,
                marginSize: 'normal' as const,
                layoutStyle: 'modern' as const,
                ...(seed.designMetadata ?? {}),
                ...(initialData?.designMetadata ?? {}),
            },
        };
    });

    const updateDocState = (patch: Partial<typeof docState>) => {
        setDocState((prev) => ({ ...prev, ...patch }));
    };

    const updateDesignMetadata = (patch: Partial<typeof docState.designMetadata>) => {
        setDocState((prev) => ({
            ...prev,
            designMetadata: { ...prev.designMetadata, ...patch },
        }));
    };

    const handleSave = () => {
        startTransition(async () => {
            const formData = new FormData();

            if (isEditing) {
                const id = initialData!._id as string;
                formData.set(`${documentType}Id`, id);
                formData.set('id', id);
            }

            // Canonical fields. Server actions can read either these or the
            // per-type aliases registered in `seed-templates.ts`.
            formData.set('documentType', documentType);
            formData.set('title', docState.title);
            formData.set('accountId', docState.accountId);
            formData.set('employeeId', docState.employeeId);
            formData.set('candidateId', docState.candidateId);
            formData.set('vendorId', docState.vendorId);
            formData.set('status', docState.status);
            formData.set('currency', docState.currency);
            formData.set('totalAmount', String(docState.totalAmount));
            if (docState.validUntil) {
                formData.set('validUntil', docState.validUntil);
            }

            // Per-type field aliases (e.g. invoice → invoiceNumber/dueDate).
            const aliases = getFieldAliases(documentType);
            if (aliases.numberField) formData.set(aliases.numberField, docState.title);
            if (aliases.dateField && docState.validUntil) {
                formData.set(aliases.dateField, docState.validUntil);
            }

            // Credit-note compatibility with the existing legacy form.
            if (documentType === 'credit_note') {
                if (!formData.has('reason')) formData.set('reason', 'other');
                if (!formData.has('refundMode')) formData.set('refundMode', 'credit');
            }

            formData.set('sections', JSON.stringify(docState.sections));
            formData.set('lineItems', JSON.stringify(docState.lineItems));
            formData.set('attachments', JSON.stringify(docState.attachments));
            formData.set('designMetadata', JSON.stringify(docState.designMetadata));

            // Caller-supplied extras (parentType, parentId, etc.).
            if (extraFormData) {
                for (const [k, v] of Object.entries(extraFormData)) {
                    formData.set(k, v);
                }
            }

            const result = await saveAction({}, formData);
            if (result?.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else if (result?.message) {
                toast({ title: 'Saved', description: result.message });
                const id = result.id || initialData?._id;
                router.push(id ? `${backHref}/${id}` : backHref);
            }
        });
    };

    const label = getDocumentLabel(documentType);

    return (
        <div className="flex h-[calc(100vh-4rem)] w-full overflow-hidden bg-zoru-background">
            {/* Main Canvas Area */}
            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Editor Header */}
                <div className="flex items-center justify-between border-b border-zoru-line bg-zoru-surface px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="sm" asChild>
                            <Link href={backHref}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back
                            </Link>
                        </Button>
                        <h1 className="text-sm font-medium text-zoru-ink">
                            {isEditing ? `Edit ${label}` : `Create ${label}`}
                        </h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button onClick={handleSave} disabled={isPending}>
                            {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            {isEditing ? 'Save changes' : `Create ${label.toLowerCase()}`}
                        </Button>
                    </div>
                </div>

                {/* Canvas Container */}
                <div className="flex-1 overflow-auto bg-zoru-surface-2 p-8">
                    <div className="mx-auto flex max-w-5xl justify-center">
                        <LiveCanvas docState={docState} updateDocState={updateDocState} documentType={documentType} />
                    </div>
                </div>
            </div>

            {/* Right Sidebar */}
            <div className="w-[350px] flex-shrink-0 border-l border-zoru-line bg-zoru-surface">
                <LiveSidebar
                    docState={docState}
                    updateDocState={updateDocState}
                    updateDesignMetadata={updateDesignMetadata}
                    documentType={documentType}
                />
            </div>
        </div>
    );
}
