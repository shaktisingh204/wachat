'use client';

import React, { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, useZoruToast } from '@/components/zoruui';
import { ArrowLeft, LoaderCircle, Save } from 'lucide-react';
import Link from 'next/link';
import { LiveSidebar } from './live-sidebar';
import { LiveCanvas } from './live-canvas';

export type DocumentType = 'proposal' | 'estimate' | 'quotation' | 'invoice' | 'delivery' | 'order' | 'proforma' | 'credit_note';

export interface LiveDocumentEditorProps {
    documentType: DocumentType;
    initialData?: Record<string, any> | null;
    saveAction: (prevState: any, formData: FormData) => Promise<{ message?: string; error?: string; id?: string }>;
    backHref: string;
}

export function LiveDocumentEditor({ documentType, initialData, saveAction, backHref }: LiveDocumentEditorProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;
    const [isPending, startTransition] = useTransition();

    // The shared document state
    const [docState, setDocState] = useState(() => {
        // Hydrate from initialData
        return {
            title: initialData?.title || 'Untitled Document',
            accountId: initialData?.accountId || '',
            status: initialData?.status || 'draft',
            currency: initialData?.currency || 'INR',
            totalAmount: initialData?.totalAmount || 0,
            validUntil: initialData?.validUntil || '',
            sections: initialData?.sections || [{ heading: '', body: '' }],
            lineItems: initialData?.lineItems || [],
            attachments: initialData?.attachments || [],
            // Sidebar design/customizations state
            designMetadata: initialData?.designMetadata || {
                themeColor: '#0f172a',
                fontFamily: 'Inter',
                showLogo: true,
                showWatermark: false,
                marginSize: 'normal',
                layoutStyle: 'modern'
            }
        };
    });

    const updateDocState = (patch: Partial<typeof docState>) => {
        setDocState((prev) => ({ ...prev, ...patch }));
    };

    const updateDesignMetadata = (patch: Partial<typeof docState.designMetadata>) => {
        setDocState((prev) => ({
            ...prev,
            designMetadata: { ...prev.designMetadata, ...patch }
        }));
    };

    const handleSave = () => {
        startTransition(async () => {
            const formData = new FormData();
            if (isEditing) {
                formData.set(`${documentType}Id`, initialData!._id as string);
                // Fallback for some forms that specifically use proposalId or invoiceId
                formData.set('id', initialData!._id as string);
            }
            
            formData.set('title', docState.title);
            formData.set('accountId', docState.accountId);
            formData.set('status', docState.status);
            formData.set('currency', docState.currency);
            formData.set('totalAmount', String(docState.totalAmount));
            if (docState.validUntil) {
                formData.set('validUntil', docState.validUntil);
            }
            
            // Document type specific aliases to support existing actions
            if (documentType === 'invoice') {
                formData.set('invoiceNumber', docState.title);
                formData.set('dueDate', docState.validUntil);
            } else if (documentType === 'quotation') {
                formData.set('quotationNumber', docState.title);
                formData.set('validTillDate', docState.validUntil);
            } else if (documentType === 'delivery') {
                formData.set('challanNumber', docState.title);
                formData.set('challanDate', docState.validUntil);
            } else if (documentType === 'order') {
                formData.set('orderNumber', docState.title);
                formData.set('orderDate', docState.validUntil);
            } else if (documentType === 'proforma') {
                formData.set('proformaNumber', docState.title);
                formData.set('proformaDate', docState.validUntil);
            } else if (documentType === 'credit_note') {
                formData.set('creditNoteNumber', docState.title);
                formData.set('creditNoteDate', docState.validUntil);
                // Hardcode some defaults that were on the old form for now
                if (!formData.has('reason')) formData.set('reason', 'other');
                if (!formData.has('refundMode')) formData.set('refundMode', 'credit');
            }

            formData.set('sections', JSON.stringify(docState.sections));
            formData.set('lineItems', JSON.stringify(docState.lineItems));
            formData.set('attachments', JSON.stringify(docState.attachments));
            formData.set('designMetadata', JSON.stringify(docState.designMetadata));

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
                            {isEditing ? `Edit ${documentType}` : `Create ${documentType}`}
                        </h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button onClick={handleSave} disabled={isPending}>
                            {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            {isEditing ? 'Save changes' : 'Create document'}
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
