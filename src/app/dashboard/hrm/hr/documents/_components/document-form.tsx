'use client';

import { Button, Card, Checkbox, Input, Label, Textarea, useToast } from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect,
  useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ArrowLeft,
  FileUp,
  LoaderCircle,
  Save } from 'lucide-react';

// 1E.sweep done — category/entityKind/status converted to <EnumFormField>
// using `documentCategory` / `documentEntityKind` / `documentStatus`.
// TODO 1E.sweep: employeeId/candidateId/entityId still raw text — convert
// to <EntityFormField entity="employee" /> etc. once the entity registry
// supports polymorphic lookup.

/**
 * <DocumentForm /> — create + edit form for HR Documents.
 *
 * Binds to the `saveDocument` server action via `useActionState`. The
 * `fileUrl` slot uses `<SabFilePickerButton>` — SabFiles policy forbids
 * any free-text URL paste for file inputs.
 */

import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';
import { EnumFormField } from '@/components/crm/enum-form-field';

import { saveDocument } from '@/app/actions/crm-documents.actions';
import type {
    CrmDocumentDoc,
    CrmDocumentStatus,
} from '@/lib/rust-client/crm-documents';

const BASE = '/dashboard/hrm/hr/documents';

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
        <Button type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create document'}
        </Button>
    );
}

export function DocumentForm({ initialData }: DocumentFormProps) {
    const router = useRouter();
    const { toast } = useToast();
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
        <Card className="p-6">
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
                    <Label htmlFor="name">Name *</Label>
                    <Input
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
                        <Label>Category</Label>
                        <EnumFormField
                            name="category-picker"
                            enumName="documentCategory"
                            initialId={category}
                            onChange={(id) => setCategory(id ?? 'other')}
                            allowInlineCreate={false}
                            placeholder="Pick a category…"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="documentNumber">Document number</Label>
                        <Input
                            id="documentNumber"
                            name="documentNumber"
                            placeholder="e.g. 1234-5678-9012"
                            defaultValue={initialData?.documentNumber ?? ''}
                        />
                    </div>
                </div>

                {/* Row 3: Description */}
                <div className="space-y-1.5">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                        id="description"
                        name="description"
                        rows={3}
                        placeholder="Short description of this document."
                        defaultValue={initialData?.description ?? ''}
                    />
                </div>

                {/* Row 4: File (SabFile) */}
                <div className="space-y-1.5">
                    <Label>Attached file</Label>
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
                                    className="max-w-[260px] truncate text-[12.5px] text-[var(--st-text)] underline-offset-2 hover:underline"
                                >
                                    {fileName || fileUrl}
                                </a>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearFile}
                                >
                                    Remove
                                </Button>
                            </>
                        ) : (
                            <span className="text-[12px] text-[var(--st-text-secondary)]">
                                No file attached.
                            </span>
                        )}
                    </div>
                </div>

                {/* Row 5: Linked entity */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <Label>Entity kind</Label>
                        <EnumFormField
                            name="entityKind-picker"
                            enumName="documentEntityKind"
                            initialId={entityKind}
                            onChange={(id) => setEntityKind(id ?? 'employee')}
                            allowInlineCreate={false}
                            placeholder="Linked to…"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="entityId">Entity id</Label>
                        <Input
                            id="entityId"
                            name="entityId"
                            placeholder="ObjectId of the linked record"
                            defaultValue={initialData?.entityId ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="employeeName">Employee name</Label>
                        <Input
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
                        <Label htmlFor="employeeId">Employee id</Label>
                        <Input
                            id="employeeId"
                            name="employeeId"
                            placeholder="Optional employee ObjectId"
                            defaultValue={initialData?.employeeId ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="candidateId">Candidate id</Label>
                        <Input
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
                        <Label htmlFor="issueDate">Issue date</Label>
                        <Input
                            id="issueDate"
                            name="issueDate"
                            type="date"
                            defaultValue={toDateInput(initialData?.issueDate)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="expiryDate">Expiry date</Label>
                        <Input
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
                        <Label htmlFor="tags">Tags</Label>
                        <Input
                            id="tags"
                            name="tags"
                            placeholder="comma, separated, tags"
                            defaultValue={tagsInitial}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Status</Label>
                        <EnumFormField
                            name="status-picker"
                            enumName="documentStatus"
                            initialId={status}
                            onChange={(id) =>
                                setStatus((id as CrmDocumentStatus) ?? 'pending')
                            }
                            allowInlineCreate={false}
                            placeholder="Status"
                        />
                    </div>
                </div>

                {/* Row 9: Notes + Confidential flag */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                            id="notes"
                            name="notes"
                            rows={3}
                            placeholder="Internal notes (not shown to employees)."
                            defaultValue={initialData?.notes ?? ''}
                        />
                    </div>
                    <div className="flex items-center gap-2 self-end pb-1.5">
                        <Checkbox
                            id="isConfidential"
                            name="isConfidential"
                            defaultChecked={!!initialData?.isConfidential}
                        />
                        <Label
                            htmlFor="isConfidential"
                            className="cursor-pointer"
                        >
                            Confidential — restrict to HR only
                        </Label>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <Button variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to documents
                        </Link>
                    </Button>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </Card>
    );
}
