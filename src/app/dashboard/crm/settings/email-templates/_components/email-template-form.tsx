'use client';

/**
 * <EmailTemplateForm /> — create + edit form for CRM email templates.
 *
 * Binds to `saveEmailTemplate` via `useActionState`. The body is a
 * plain textarea with merge-variable helper text underneath
 * (`{{contact.name}}`, etc.); a rich-text editor can come later.
 */

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ArrowLeft, LoaderCircle, Save } from 'lucide-react';

import {
    ZoruButton,
    ZoruCard,
    ZoruInput,
    ZoruLabel,
    ZoruSwitch,
    ZoruTextarea,
    useZoruToast,
} from '@/components/zoruui';
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

export function EmailTemplateForm({
    initialData,
}: {
    initialData?: CrmEmailTemplateDoc | null;
}) {
    const router = useRouter();
    const { toast } = useZoruToast();
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
        <ZoruCard className="p-6">
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
                        <ZoruLabel htmlFor="name">Name *</ZoruLabel>
                        <ZoruInput
                            id="name"
                            name="name"
                            required
                            placeholder="e.g. Welcome to SabNode"
                            defaultValue={initialData?.name ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="category-trigger">Category</ZoruLabel>
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
                    <ZoruLabel htmlFor="subject">Subject *</ZoruLabel>
                    <ZoruInput
                        id="subject"
                        name="subject"
                        required
                        placeholder="Hi {{contact.name}}, welcome!"
                        defaultValue={initialData?.subject ?? ''}
                    />
                </div>

                {/* Row 3: HTML body */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="body">Body (HTML) *</ZoruLabel>
                    <ZoruTextarea
                        id="body"
                        name="body"
                        rows={12}
                        required
                        spellCheck
                        placeholder="<p>Hello {{contact.name}},</p>&#10;<p>…</p>"
                        defaultValue={initialData?.body ?? ''}
                        className="font-mono text-[12.5px]"
                    />
                    <p className="text-[12px] text-zoru-ink-muted">
                        Use <code className="font-mono">{`{{contact.name}}`}</code>,{' '}
                        <code className="font-mono">{`{{contact.email}}`}</code>,{' '}
                        <code className="font-mono">{`{{contact.company}}`}</code>,{' '}
                        <code className="font-mono">{`{{user.name}}`}</code> as
                        merge variables.
                    </p>
                </div>

                {/* Row 4: Plain-text body */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="textBody">Plain-text fallback</ZoruLabel>
                    <ZoruTextarea
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
                        <ZoruLabel htmlFor="variables">Variables</ZoruLabel>
                        <ZoruInput
                            id="variables"
                            name="variables"
                            placeholder="contact.name, contact.email"
                            defaultValue={variablesInitial}
                        />
                        <p className="text-[11.5px] text-zoru-ink-muted">
                            Comma-separated. Used for validation when sending.
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="status-trigger">Status</ZoruLabel>
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
                        <ZoruSwitch
                            id="isActive-toggle"
                            checked={isActive}
                            onCheckedChange={(v) => setIsActive(v === true)}
                        />
                        <ZoruLabel
                            htmlFor="isActive-toggle"
                            className="cursor-pointer pb-2"
                        >
                            Available in template picker
                        </ZoruLabel>
                    </div>
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
