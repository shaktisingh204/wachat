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

// 1E.sweep done — category/status converted to <EnumFormField> using
// `documentTemplateCategory` / `documentTemplateStatus`.

/**
 * <DocumentTemplateForm /> — create + edit form for HR Document Templates.
 *
 * Binds to the `saveDocumentTemplate` server action via `useActionState`.
 * The `templateFileUrl` slot uses `<SabFilePickerButton>` only — never a
 * free-text URL paste.
 */

import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';
import { EnumFormField } from '@/components/crm/enum-form-field';

import {
    saveDocumentTemplate,
    type CrmDocumentTemplateDoc,
    type CrmDocumentTemplateStatus,
} from '@/app/actions/crm-document-templates.actions';

const BASE = '/dashboard/hrm/hr/document-templates';

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
        <Button type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create template'}
        </Button>
    );
}

export function DocumentTemplateForm({ initialData }: DocumentTemplateFormProps) {
    const router = useRouter();
    const { toast } = useToast();
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
        <Card className="p-6">
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
                    <Label htmlFor="name">Name *</Label>
                    <Input
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
                        <Label>Category</Label>
                        <EnumFormField
                            name="category-picker"
                            enumName="documentTemplateCategory"
                            initialId={category}
                            onChange={(id) => setCategory(id ?? 'other')}
                            allowInlineCreate={false}
                            placeholder="Pick a category…"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Status</Label>
                        <EnumFormField
                            name="status-picker"
                            enumName="documentTemplateStatus"
                            initialId={status}
                            onChange={(id) =>
                                setStatus((id as CrmDocumentTemplateStatus) ?? 'draft')
                            }
                            allowInlineCreate={false}
                            placeholder="Status"
                        />
                    </div>
                </div>

                {/* Row 3: Body (markdown) */}
                <div className="space-y-1.5">
                    <Label htmlFor="body">Body (markdown)</Label>
                    <Textarea
                        id="body"
                        name="body"
                        rows={12}
                        placeholder={
                            'e.g. Dear {{ employeeName }},\n\nWe are pleased to offer you the role of {{ role }}…'
                        }
                        defaultValue={initialData?.body ?? ''}
                    />
                    <p className="text-[11.5px] text-[var(--st-text-secondary)]">
                        Use <code>{'{{ variableName }}'}</code> placeholders. Markdown is
                        supported.
                    </p>
                </div>

                {/* Row 4: Variables */}
                <div className="space-y-1.5">
                    <Label htmlFor="variables">Variables</Label>
                    <Input
                        id="variables"
                        name="variables"
                        placeholder="employeeName, role, startDate, salary"
                        defaultValue={variablesInitial}
                    />
                    <p className="text-[11.5px] text-[var(--st-text-secondary)]">
                        Comma-separated list of variable names referenced by the body.
                    </p>
                </div>

                {/* Row 5: Template file (SabFile) */}
                <div className="space-y-1.5">
                    <Label>Template file (optional)</Label>
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
                                    className="max-w-[260px] truncate text-[12.5px] text-[var(--st-text)] underline-offset-2 hover:underline"
                                >
                                    {templateFileName || templateFileUrl}
                                </a>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearTemplate}
                                >
                                    Remove
                                </Button>
                            </>
                        ) : (
                            <span className="text-[12px] text-[var(--st-text-secondary)]">
                                No template file attached.
                            </span>
                        )}
                    </div>
                </div>

                {/* Row 6: Active flag */}
                <div className="flex items-center gap-2 pb-1.5">
                    <Checkbox
                        id="isActive"
                        name="isActive"
                        defaultChecked={initialData?.isActive ?? true}
                    />
                    <Label htmlFor="isActive" className="cursor-pointer">
                        Active — available for new document generation
                    </Label>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <Button variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to templates
                        </Link>
                    </Button>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </Card>
    );
}
