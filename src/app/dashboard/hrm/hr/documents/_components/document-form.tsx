'use client';

// TODO 1E.sweep: visibility/access -> <EnumFormField enumName="documentVisibility">; category/type left ambiguous (extend catalogue first); employee owner -> <EntityFormField entity="employee">. See plan §1E.

/**
 * <DocumentForm /> — create + edit form for HR Documents.
 *
 * Binds to the `saveDocument` server action via `useActionState`. The
 * `fileUrl` slot uses `<SabFilePickerButton>` — SabFiles policy forbids
 * any free-text URL paste for file inputs.
 */

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ArrowLeft, FileUp, LoaderCircle, Save } from 'lucide-react';

import {
    ZoruButton,
    ZoruCard,
    ZoruCheckbox,
    ZoruInput,
    ZoruLabel,
    ZoruSelect,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
    ZoruTextarea,
    useZoruToast,
} from '@/components/zoruui';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';

import { saveDocument } from '@/app/actions/crm-documents.actions';
import type {
    CrmDocumentCategory,
    CrmDocumentDoc,
    CrmDocumentEntityKind,
    CrmDocumentStatus,
} from '@/lib/rust-client/crm-documents';

const BASE = '/dashboard/hrm/hr/documents';

const CATEGORY_OPTIONS: Array<{ value: CrmDocumentCategory; label: string }> = [
    { value: 'id_proof', label: 'ID proof' },
    { value: 'address_proof', label: 'Address proof' },
    { value: 'qualification', label: 'Qualification' },
    { value: 'experience', label: 'Experience' },
    { value: 'contract', label: 'Contract' },
    { value: 'appointment', label: 'Appointment' },
    { value: 'resignation', label: 'Resignation' },
    { value: 'other', label: 'Other' },
];

const ENTITY_KIND_OPTIONS: Array<{ value: CrmDocumentEntityKind; label: string }> = [
    { value: 'employee', label: 'Employee' },
    { value: 'candidate', label: 'Candidate' },
    { value: 'contact', label: 'Contact' },
    { value: 'account', label: 'Account' },
    { value: 'vendor', label: 'Vendor' },
];

const STATUS_OPTIONS: Array<{ value: CrmDocumentStatus; label: string }> = [
    { value: 'pending', label: 'Pending' },
    { value: 'verified', label: 'Verified' },
    { value: 'expired', label: 'Expired' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'archived', label: 'Archived' },
];

function toDateInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

function nameFromUrl(url: string): string {
    if (!url) return '';
    try {
        const path = new URL(url, 'http://x').pathname;
        return decodeURIComponent(path.split('/').pop() ?? '') || url;
    } catch {
        return url;
    }
}

interface DocumentFormProps {
    initialData?: CrmDocumentDoc | null;
}

type SaveState = { message?: string; error?: string; id?: string };
const initialState: SaveState = {};

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create document'}
        </ZoruButton>
    );
}

export function DocumentForm({ initialData }: DocumentFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveDocument, initialState);

    const [fileUrl, setFileUrl] = useState<string>(initialData?.fileUrl ?? '');
    const [fileName, setFileName] = useState<string>(() =>
        nameFromUrl(initialData?.fileUrl ?? ''),
    );
    const [fileMime, setFileMime] = useState<string>(initialData?.mimeType ?? '');
    const [fileSize, setFileSize] = useState<string>(
        initialData?.fileSize != null ? String(initialData.fileSize) : '',
    );

    const [category, setCategory] = useState<string>(
        initialData?.category ?? 'other',
    );
    const [entityKind, setEntityKind] = useState<string>(
        initialData?.entityKind ?? 'employee',
    );
    const [status, setStatus] = useState<CrmDocumentStatus>(
        (initialData?.status as CrmDocumentStatus) ?? 'pending',
    );

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            const id = state.id ?? initialData?._id;
            if (id) router.push(`${BASE}/${id}`);
            else router.push(BASE);
        }
        if (state?.error) {
            toast({
                title: 'Error',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast, router, initialData?._id]);

    const onPickFile = (pick: SabFilePick) => {
        setFileUrl(pick.url);
        setFileName(pick.name);
        setFileMime(pick.mime ?? '');
        setFileSize(pick.size != null ? String(pick.size) : '');
    };

    const clearFile = () => {
        setFileUrl('');
        setFileName('');
        setFileMime('');
        setFileSize('');
    };

    const tagsInitial = Array.isArray(initialData?.tags)
        ? (initialData?.tags ?? []).join(', ')
        : '';

    return (
        <ZoruCard className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input type="hidden" name="documentId" value={initialData!._id} />
                ) : null}
                <input type="hidden" name="fileUrl" value={fileUrl} />
                <input type="hidden" name="mimeType" value={fileMime} />
                <input type="hidden" name="fileSize" value={fileSize} />
                <input type="hidden" name="category" value={category} />
                <input type="hidden" name="entityKind" value={entityKind} />
                <input type="hidden" name="status" value={status} />

                {/* Row 1: Name */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="name">Name *</ZoruLabel>
                    <ZoruInput
                        id="name"
                        name="name"
                        required
                        placeholder="e.g. Aadhaar — Rahul Sharma"
                        defaultValue={initialData?.name ?? ''}
                    />
                </div>

                {/* Row 2: Category + Document number */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="category-trigger">Category</ZoruLabel>
                        <ZoruSelect value={category} onValueChange={setCategory}>
                            <ZoruSelectTrigger id="category-trigger">
                                <ZoruSelectValue placeholder="Pick a category…" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {CATEGORY_OPTIONS.map((o) => (
                                    <ZoruSelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="documentNumber">Document number</ZoruLabel>
                        <ZoruInput
                            id="documentNumber"
                            name="documentNumber"
                            placeholder="e.g. 1234-5678-9012"
                            defaultValue={initialData?.documentNumber ?? ''}
                        />
                    </div>
                </div>

                {/* Row 3: Description */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="description">Description</ZoruLabel>
                    <ZoruTextarea
                        id="description"
                        name="description"
                        rows={3}
                        placeholder="Short description of this document."
                        defaultValue={initialData?.description ?? ''}
                    />
                </div>

                {/* Row 4: File (SabFile) */}
                <div className="space-y-1.5">
                    <ZoruLabel>Attached file</ZoruLabel>
                    <div className="flex flex-wrap items-center gap-2">
                        <SabFilePickerButton
                            accept="document"
                            onPick={onPickFile}
                            title="Pick a document file"
                        >
                            <FileUp className="mr-1.5 h-4 w-4" />
                            {fileUrl ? 'Replace file' : 'Choose from SabFiles'}
                        </SabFilePickerButton>
                        {fileUrl ? (
                            <>
                                <a
                                    href={fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="max-w-[260px] truncate text-[12.5px] text-zoru-ink underline-offset-2 hover:underline"
                                >
                                    {fileName || fileUrl}
                                </a>
                                <ZoruButton
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearFile}
                                >
                                    Remove
                                </ZoruButton>
                            </>
                        ) : (
                            <span className="text-[12px] text-zoru-ink-muted">
                                No file attached.
                            </span>
                        )}
                    </div>
                </div>

                {/* Row 5: Linked entity */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="entityKind-trigger">Entity kind</ZoruLabel>
                        <ZoruSelect value={entityKind} onValueChange={setEntityKind}>
                            <ZoruSelectTrigger id="entityKind-trigger">
                                <ZoruSelectValue placeholder="Linked to…" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {ENTITY_KIND_OPTIONS.map((o) => (
                                    <ZoruSelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="entityId">Entity id</ZoruLabel>
                        <ZoruInput
                            id="entityId"
                            name="entityId"
                            placeholder="ObjectId of the linked record"
                            defaultValue={initialData?.entityId ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="employeeName">Employee name</ZoruLabel>
                        <ZoruInput
                            id="employeeName"
                            name="employeeName"
                            placeholder="Display name (optional)"
                            defaultValue={initialData?.employeeName ?? ''}
                        />
                    </div>
                </div>

                {/* Row 6: Employee + Candidate ids */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="employeeId">Employee id</ZoruLabel>
                        <ZoruInput
                            id="employeeId"
                            name="employeeId"
                            placeholder="Optional employee ObjectId"
                            defaultValue={initialData?.employeeId ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="candidateId">Candidate id</ZoruLabel>
                        <ZoruInput
                            id="candidateId"
                            name="candidateId"
                            placeholder="Optional candidate ObjectId"
                            defaultValue={initialData?.candidateId ?? ''}
                        />
                    </div>
                </div>

                {/* Row 7: Dates */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="issueDate">Issue date</ZoruLabel>
                        <ZoruInput
                            id="issueDate"
                            name="issueDate"
                            type="date"
                            defaultValue={toDateInput(initialData?.issueDate)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="expiryDate">Expiry date</ZoruLabel>
                        <ZoruInput
                            id="expiryDate"
                            name="expiryDate"
                            type="date"
                            defaultValue={toDateInput(initialData?.expiryDate)}
                        />
                    </div>
                </div>

                {/* Row 8: Tags + Status */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="tags">Tags</ZoruLabel>
                        <ZoruInput
                            id="tags"
                            name="tags"
                            placeholder="comma, separated, tags"
                            defaultValue={tagsInitial}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="status-trigger">Status</ZoruLabel>
                        <ZoruSelect
                            value={status}
                            onValueChange={(v) =>
                                setStatus(v as CrmDocumentStatus)
                            }
                        >
                            <ZoruSelectTrigger id="status-trigger">
                                <ZoruSelectValue placeholder="Status" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {STATUS_OPTIONS.map((o) => (
                                    <ZoruSelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                </div>

                {/* Row 9: Notes + Confidential flag */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="notes">Notes</ZoruLabel>
                        <ZoruTextarea
                            id="notes"
                            name="notes"
                            rows={3}
                            placeholder="Internal notes (not shown to employees)."
                            defaultValue={initialData?.notes ?? ''}
                        />
                    </div>
                    <div className="flex items-center gap-2 self-end pb-1.5">
                        <ZoruCheckbox
                            id="isConfidential"
                            name="isConfidential"
                            defaultChecked={!!initialData?.isConfidential}
                        />
                        <ZoruLabel
                            htmlFor="isConfidential"
                            className="cursor-pointer"
                        >
                            Confidential — restrict to HR only
                        </ZoruLabel>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to documents
                        </Link>
                    </ZoruButton>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </ZoruCard>
    );
}
