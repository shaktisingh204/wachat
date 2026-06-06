'use client';

import { Button, Card, Input, Label, Switch, Textarea, useToast } from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect,
  useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ArrowLeft,
  LoaderCircle,
  Save } from 'lucide-react';

/**
 * <EmailTemplateForm /> — create + edit form for CRM email templates.
 *
 * Binds to `saveEmailTemplate` via `useActionState`. The body is a
 * plain textarea with merge-variable helper text underneath
 * (`{{contact.name}}`, etc.); a rich-text editor can come later.
 */

import { EnumFormField } from '@/components/crm/enum-form-field';

import { saveEmailTemplate } from '@/app/actions/crm-email-templates.actions';
import type {
    CrmEmailTemplateDoc,
    CrmEmailTemplateStatus,
} from '@/lib/rust-client/crm-email-templates';

const BASE = '/dashboard/crm/settings/email-templates';

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

export function EmailTemplateForm({
    initialData,
}: {
    initialData?: CrmEmailTemplateDoc | null;
}) {
    const router = useRouter();
    const { toast } = useToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveEmailTemplate, initialState);
    const [category, setCategory] = useState<string>(
        initialData?.category ?? 'general',
    );
    const [status, setStatus] = useState<CrmEmailTemplateStatus>(
        (initialData?.status as CrmEmailTemplateStatus) ?? 'active',
    );
    const [isActive, setIsActive] = useState<boolean>(
        initialData?.isActive ?? true,
    );

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            router.push(BASE);
        }
        if (state?.error) {
            toast({
                title: 'Error',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast, router]);

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
                <input
                    type="hidden"
                    name="isActive"
                    value={isActive ? 'on' : 'off'}
                />

                {/* Row 1: Name + Category */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="name">Name *</Label>
                        <Input
                            id="name"
                            name="name"
                            required
                            placeholder="e.g. Welcome to SabNode"
                            defaultValue={initialData?.name ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="category-trigger">Category</Label>
                        <EnumFormField
                            name="category"
                            enumName="emailTemplateCategory"
                            initialId={category}
                            onChange={(id) => setCategory(id ?? 'general')}
                            placeholder="Pick a category…"
                        />
                    </div>
                </div>

                {/* Row 2: Subject */}
                <div className="space-y-1.5">
                    <Label htmlFor="subject">Subject *</Label>
                    <Input
                        id="subject"
                        name="subject"
                        required
                        placeholder="Hi {{contact.name}}, welcome!"
                        defaultValue={initialData?.subject ?? ''}
                    />
                </div>

                {/* Row 3: HTML body */}
                <div className="space-y-1.5">
                    <Label htmlFor="body">Body (HTML) *</Label>
                    <Textarea
                        id="body"
                        name="body"
                        rows={12}
                        required
                        spellCheck
                        placeholder="<p>Hello {{contact.name}},</p>&#10;<p>…</p>"
                        defaultValue={initialData?.body ?? ''}
                        className="font-mono text-[12.5px]"
                    />
                    <p className="text-[12px] text-[var(--st-text-secondary)]">
                        Use <code className="font-mono">{`{{contact.name}}`}</code>,{' '}
                        <code className="font-mono">{`{{contact.email}}`}</code>,{' '}
                        <code className="font-mono">{`{{contact.company}}`}</code>,{' '}
                        <code className="font-mono">{`{{user.name}}`}</code> as
                        merge variables.
                    </p>
                </div>

                {/* Row 4: Plain-text body */}
                <div className="space-y-1.5">
                    <Label htmlFor="textBody">Plain-text fallback</Label>
                    <Textarea
                        id="textBody"
                        name="textBody"
                        rows={5}
                        placeholder="Plain-text version for clients that don't render HTML."
                        defaultValue={initialData?.textBody ?? ''}
                    />
                </div>

                {/* Row 5: Variables + Status + Active */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="variables">Variables</Label>
                        <Input
                            id="variables"
                            name="variables"
                            placeholder="contact.name, contact.email"
                            defaultValue={variablesInitial}
                        />
                        <p className="text-[11.5px] text-[var(--st-text-secondary)]">
                            Comma-separated. Used for validation when sending.
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="status-trigger">Status</Label>
                        <EnumFormField
                            name="status"
                            enumName="emailTemplateStatus"
                            initialId={status}
                            onChange={(id) =>
                                setStatus((id ?? 'active') as CrmEmailTemplateStatus)
                            }
                            placeholder="Status"
                        />
                    </div>
                    <div className="flex items-end gap-2 pb-1">
                        <Switch
                            id="isActive-toggle"
                            checked={isActive}
                            onCheckedChange={(v) => setIsActive(v === true)}
                        />
                        <Label
                            htmlFor="isActive-toggle"
                            className="cursor-pointer pb-2"
                        >
                            Available in template picker
                        </Label>
                    </div>
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
