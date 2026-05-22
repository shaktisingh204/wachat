'use client';

import { Button, Card, Input, Label, Textarea, useZoruToast } from '@/components/zoruui';
import {
  useActionState,
  useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft,
  LoaderCircle,
  Save } from 'lucide-react';

/**
 * <KbArticleForm> — shared form for KB new / edit (§1D.3 bar).
 *
 * Sections: Article details · Content · SEO · Related articles ·
 * Visibility & status.
 *
 * Tags are stored as a comma-separated string on the wire (legacy);
 * SEO and related articles are new and persisted into the doc directly.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';
import {
    saveKbArticle,
    updateKbArticle,
} from '@/app/actions/crm-knowledge-base.actions';

interface KbArticleFormProps {
    mode: 'create' | 'edit';
    initial?: Record<string, unknown> | null;
    articleId?: string;
}

const initialState: { message?: string; error?: string; id?: string } = {};

function SubmitButton({ editing }: { editing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
                <Save className="h-4 w-4" />
            )}
            {editing ? 'Save changes' : 'Create article'}
        </ZoruButton>
    );
}

export function KbArticleForm({ mode, initial, articleId }: KbArticleFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const editing = mode === 'edit';
    const action = editing ? updateKbArticle : saveKbArticle;
    const [state, formAction] = useActionState(action, initialState);

    const init = (initial ?? {}) as Record<string, unknown>;
    const tagsCsv = Array.isArray(init.tags)
        ? (init.tags as unknown[]).join(', ')
        : (init.tags as string | undefined) ?? '';

    useEffect(() => {
        if (state?.message) {
            toast({ title: editing ? 'Updated' : 'Saved', description: state.message });
            const stateId = (state as { id?: string }).id;
            const id = articleId ?? stateId;
            router.push(
                id
                    ? `/dashboard/crm/tickets/knowledge-base/${id}`
                    : '/dashboard/crm/tickets/knowledge-base',
            );
        }
        if (state?.error) {
            toast({
                title: 'Error',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast, router, editing, articleId]);

    return (
        <form action={formAction} className="flex flex-col gap-6">
            {editing && articleId ? (
                <input type="hidden" name="articleId" value={articleId} />
            ) : null}

            <ZoruCard className="p-6">
                <h2 className="mb-4 text-[14px] font-medium text-zoru-ink">
                    Article details
                </h2>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                        <ZoruLabel htmlFor="title">
                            Title <span className="text-zoru-danger-ink">*</span>
                        </ZoruLabel>
                        <ZoruInput
                            id="title"
                            name="title"
                            required
                            defaultValue={(init.title as string | undefined) ?? ''}
                            placeholder="e.g. How to reset your password"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="slug">Slug</ZoruLabel>
                        <ZoruInput
                            id="slug"
                            name="slug"
                            defaultValue={(init.slug as string | undefined) ?? ''}
                            placeholder="auto-generated-from-title"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel>Category</ZoruLabel>
                        <EntityFormField
                            entity="category"
                            name="category"
                            initialId={(init.category as string | undefined) ?? null}
                            initialLabel={(init.category as string | undefined) ?? ''}
                            placeholder="Pick a category…"
                        />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                        <ZoruLabel htmlFor="tags">Tags</ZoruLabel>
                        <ZoruInput
                            id="tags"
                            name="tags"
                            defaultValue={tagsCsv}
                            placeholder="Comma-separated: billing, setup, …"
                        />
                    </div>
                </div>
            </ZoruCard>

            <ZoruCard className="p-6">
                <h2 className="mb-4 text-[14px] font-medium text-zoru-ink">Content</h2>
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="body">
                        Body (Markdown) <span className="text-zoru-danger-ink">*</span>
                    </ZoruLabel>
                    <ZoruTextarea
                        id="body"
                        name="body"
                        rows={16}
                        required
                        defaultValue={(init.body as string | undefined) ?? ''}
                        placeholder="Write the article content here. Markdown supported."
                    />
                </div>
            </ZoruCard>

            <ZoruCard className="p-6">
                <h2 className="mb-4 text-[14px] font-medium text-zoru-ink">
                    SEO & links
                </h2>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                        <ZoruLabel htmlFor="seoTitle">SEO title</ZoruLabel>
                        <ZoruInput
                            id="seoTitle"
                            name="seoTitle"
                            defaultValue={(init.seoTitle as string | undefined) ?? ''}
                            placeholder="Optional — shown in search results"
                        />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                        <ZoruLabel htmlFor="seoDescription">SEO description</ZoruLabel>
                        <ZoruTextarea
                            id="seoDescription"
                            name="seoDescription"
                            rows={2}
                            defaultValue={(init.seoDescription as string | undefined) ?? ''}
                            placeholder="Optional — 1-2 sentences for search engines"
                        />
                    </div>
                </div>
            </ZoruCard>

            <ZoruCard className="p-6">
                <h2 className="mb-4 text-[14px] font-medium text-zoru-ink">
                    Visibility & status
                </h2>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel>Visibility</ZoruLabel>
                        <EnumFormField
                            enumName="kbVisibility"
                            name="visibility"
                            initialId={(init.visibility as string | undefined) ?? 'internal'}
                            placeholder="Select visibility"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel>Status</ZoruLabel>
                        <EnumFormField
                            enumName="kbStatus"
                            name="status"
                            initialId={(init.status as string | undefined) ?? 'draft'}
                            placeholder="Select status"
                        />
                    </div>
                </div>
            </ZoruCard>

            <div className="flex items-center justify-between">
                <ZoruButton variant="ghost" asChild>
                    <Link
                        href={
                            editing && articleId
                                ? `/dashboard/crm/tickets/knowledge-base/${articleId}`
                                : '/dashboard/crm/tickets/knowledge-base'
                        }
                    >
                        <ArrowLeft className="h-4 w-4" /> Cancel
                    </Link>
                </ZoruButton>
                <SubmitButton editing={editing} />
            </div>
        </form>
    );
}

export default KbArticleForm;
