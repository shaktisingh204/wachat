'use client';

// TODO 1E.sweep: type/category dropdowns -> <EnumFormField>. See plan §1E.

/**
 * <DocumentTemplateForm /> — create + edit form for HR Document Templates.
 *
 * Binds to the `saveDocumentTemplate` server action via `useActionState`.
 * The `templateFileUrl` slot uses `<SabFilePickerButton>` only — never a
 * free-text URL paste.
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

import {
    saveDocumentTemplate,
    type CrmDocumentTemplateDoc,
    type CrmDocumentTemplateStatus,
} from '@/app/actions/crm-document-templates.actions';

const BASE = '/dashboard/hrm/hr/document-templates';

const STATUS_OPTIONS: Array<{ value: CrmDocumentTemplateStatus; label: string }> = [
    { value: 'draft', label: 'Draft' },
    { value: 'active', label: 'Active' },
    { value: 'archived', label: 'Archived' },
];

const CATEGORY_OPTIONS = [
    { value: 'offer_letter', label: 'Offer letter' },
    { value: 'appointment_letter', label: 'Appointment letter' },
    { value: 'contract', label: 'Contract' },
    { value: 'nda', label: 'NDA' },
    { value: 'relieving_letter', label: 'Relieving letter' },
    { value: 'experience_letter', label: 'Experience letter' },
    { value: 'warning_letter', label: 'Warning letter' },
    { value: 'other', label: 'Other' },
];

function nameFromUrl(url: string): string {
    if (!url) return '';
    try {
        const path = new URL(url, 'http://x').pathname;
        return decodeURIComponent(path.split('/').pop() ?? '') || url;
    } catch {
        return url;
    }
}

interface DocumentTemplateFormProps {
    initialData?: CrmDocumentTemplateDoc | null;
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
            {isEditing ? 'Save changes' : 'Create template'}
        </ZoruButton>
    );
}

export function DocumentTemplateForm({ initialData }: DocumentTemplateFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveDocumentTemplate, initialState);

    const [templateFileUrl, setTemplateFileUrl] = useState<string>(
        initialData?.templateFileUrl ?? '',
    );
    const [templateFileName, setTemplateFileName] = useState<string>(() =>
        nameFromUrl(initialData?.templateFileUrl ?? ''),
    );

    const [category, setCategory] = useState<string>(
        initialData?.category ?? 'other',
    );
    const [status, setStatus] = useState<CrmDocumentTemplateStatus>(
        initialData?.status ?? 'draft',
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

    const onPickTemplate = (pick: SabFilePick) => {
        setTemplateFileUrl(pick.url);
        setTemplateFileName(pick.name);
    };

    const clearTemplate = () => {
        setTemplateFileUrl('');
        setTemplateFileName('');
    };

    const variablesInitial = Array.isArray(initialData?.variables)
        ? (initialData?.variables ?? []).join(', ')
        : '';

    return (
        <ZoruCard className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input
                        type="hidden"
                        name="templateId"
                        value={initialData!._id}
                    />
                ) : null}
                <input type="hidden" name="templateFileUrl" value={templateFileUrl} />
                <input type="hidden" name="category" value={category} />
                <input type="hidden" name="status" value={status} />

                {/* Row 1: Name */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="name">Name *</ZoruLabel>
                    <ZoruInput
                        id="name"
                        name="name"
                        required
                        placeholder="e.g. Standard offer letter"
                        defaultValue={initialData?.name ?? ''}
                    />
                </div>

                {/* Row 2: Category + Status */}
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
                        <ZoruLabel htmlFor="status-trigger">Status</ZoruLabel>
                        <ZoruSelect
                            value={status}
                            onValueChange={(v) =>
                                setStatus(v as CrmDocumentTemplateStatus)
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

                {/* Row 3: Body (markdown) */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="body">Body (markdown)</ZoruLabel>
                    <ZoruTextarea
                        id="body"
                        name="body"
                        rows={12}
                        placeholder={
                            'e.g. Dear {{ employeeName }},\n\nWe are pleased to offer you the role of {{ role }}…'
                        }
                        defaultValue={initialData?.body ?? ''}
                    />
                    <p className="text-[11.5px] text-zoru-ink-muted">
                        Use <code>{'{{ variableName }}'}</code> placeholders. Markdown is
                        supported.
                    </p>
                </div>

                {/* Row 4: Variables */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="variables">Variables</ZoruLabel>
                    <ZoruInput
                        id="variables"
                        name="variables"
                        placeholder="employeeName, role, startDate, salary"
                        defaultValue={variablesInitial}
                    />
                    <p className="text-[11.5px] text-zoru-ink-muted">
                        Comma-separated list of variable names referenced by the body.
                    </p>
                </div>

                {/* Row 5: Template file (SabFile) */}
                <div className="space-y-1.5">
                    <ZoruLabel>Template file (optional)</ZoruLabel>
                    <div className="flex flex-wrap items-center gap-2">
                        <SabFilePickerButton
                            accept="document"
                            onPick={onPickTemplate}
                            title="Pick a template file"
                        >
                            <FileUp className="mr-1.5 h-4 w-4" />
                            {templateFileUrl
                                ? 'Replace template file'
                                : 'Choose from SabFiles'}
                        </SabFilePickerButton>
                        {templateFileUrl ? (
                            <>
                                <a
                                    href={templateFileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="max-w-[260px] truncate text-[12.5px] text-zoru-ink underline-offset-2 hover:underline"
                                >
                                    {templateFileName || templateFileUrl}
                                </a>
                                <ZoruButton
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearTemplate}
                                >
                                    Remove
                                </ZoruButton>
                            </>
                        ) : (
                            <span className="text-[12px] text-zoru-ink-muted">
                                No template file attached.
                            </span>
                        )}
                    </div>
                </div>

                {/* Row 6: Active flag */}
                <div className="flex items-center gap-2 pb-1.5">
                    <ZoruCheckbox
                        id="isActive"
                        name="isActive"
                        defaultChecked={initialData?.isActive ?? true}
                    />
                    <ZoruLabel htmlFor="isActive" className="cursor-pointer">
                        Active — available for new document generation
                    </ZoruLabel>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to templates
                        </Link>
                    </ZoruButton>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </ZoruCard>
    );
}
