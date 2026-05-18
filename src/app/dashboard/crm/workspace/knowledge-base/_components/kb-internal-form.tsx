'use client';

import {
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
import {
  useActionState,
  useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { EntityFormShell } from '@/components/crm/entity-form-shell';
import { EnumFormField } from '@/components/crm/enum-form-field';

/**
 * Internal KB form (§1D.3) — shared by /new and /[id]/edit.
 *
 * Preserves FormData keys used by `saveKnowledgeBase`: title, description,
 * category_id, type, to_do, pinned.
 */

import * as React from 'react';

import {
    getKnowledgeBaseCategories,
    saveKnowledgeBase,
} from '@/app/actions/worksuite/knowledge.actions';
import type {
    WsKnowledgeBase,
    WsKnowledgeBaseCategory,
} from '@/lib/worksuite/knowledge-types';

export interface KbInternalFormProps {
    mode: 'new' | 'edit';
    article?: (WsKnowledgeBase & { _id: string }) | null;
}

export function KbInternalForm({
    mode,
    article,
}: KbInternalFormProps): React.JSX.Element {
    const router = useRouter();
    const { toast } = useZoruToast();
    const [state, formAction] = useActionState(saveKnowledgeBase, {
        message: '',
        error: '',
    } as { message?: string; error?: string });
    const [categories, setCategories] = React.useState<
        (WsKnowledgeBaseCategory & { _id: string })[]
    >([]);

    useEffect(() => {
        getKnowledgeBaseCategories().then((c) =>
            setCategories(c as (WsKnowledgeBaseCategory & { _id: string })[]),
        );
    }, []);

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            router.push('/dashboard/crm/workspace/knowledge-base');
        }
        if (state?.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router]);

    return (
        <EntityFormShell
            title={mode === 'edit' ? 'Edit article' : 'New article'}
            subtitle="Author internal documentation, runbooks, or reference material."
            action={formAction}
            cancelHref="/dashboard/crm/workspace/knowledge-base"
            submitLabel={mode === 'edit' ? 'Save changes' : 'Save article'}
            hiddenInputs={
                article?._id ? <input type="hidden" name="id" value={article._id} /> : null
            }
            error={state?.error}
            message={state?.message}
            sections={[
                {
                    id: 'content',
                    title: 'Content',
                    description: 'Title and body. Supports plain text and Markdown.',
                    children: (
                        <div className="grid gap-4">
                            <div>
                                <ZoruLabel htmlFor="title">Title *</ZoruLabel>
                                <ZoruInput
                                    id="title"
                                    name="title"
                                    required
                                    defaultValue={article?.title ?? ''}
                                    className="mt-1.5 h-10"
                                />
                            </div>
                            <div>
                                <ZoruLabel htmlFor="description">Description</ZoruLabel>
                                <ZoruTextarea
                                    id="description"
                                    name="description"
                                    rows={10}
                                    defaultValue={article?.description ?? ''}
                                    className="mt-1.5"
                                    placeholder="Write your article body here."
                                />
                            </div>
                        </div>
                    ),
                },
                {
                    id: 'meta',
                    title: 'Type & categorisation',
                    description: 'Pick the article kind and group.',
                    children: (
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <ZoruLabel htmlFor="category_id">Category</ZoruLabel>
                                {/* TODO 1E.sweep: dynamic list — needs EntityKey "knowledgeBaseCategory" */}
                                <ZoruSelect
                                    name="category_id"
                                    defaultValue={article?.category_id ?? ''}
                                >
                                    <ZoruSelectTrigger id="category_id" className="mt-1.5 h-10">
                                        <ZoruSelectValue placeholder="Select category" />
                                    </ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        {categories.map((c) => (
                                            <ZoruSelectItem key={c._id} value={c._id}>
                                                {c.name}
                                            </ZoruSelectItem>
                                        ))}
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                            <div>
                                <ZoruLabel htmlFor="type">Type *</ZoruLabel>
                                <div className="mt-1.5">
                                    <EnumFormField
                                        name="type"
                                        enumName="kbArticleType"
                                        initialId={article?.type ?? 'article'}
                                        allowInlineCreate={false}
                                    />
                                </div>
                            </div>
                            <div>
                                <ZoruLabel htmlFor="to_do">To-do</ZoruLabel>
                                <div className="mt-1.5">
                                    <EnumFormField
                                        name="to_do"
                                        enumName="yesNo"
                                        initialId={article?.to_do ?? 'no'}
                                        allowInlineCreate={false}
                                    />
                                </div>
                            </div>
                            <div>
                                <ZoruLabel htmlFor="pinned">Pinned (published)</ZoruLabel>
                                <div className="mt-1.5">
                                    <EnumFormField
                                        name="pinned"
                                        enumName="yesNo"
                                        initialId={article?.pinned ? 'yes' : 'no'}
                                        allowInlineCreate={false}
                                    />
                                </div>
                            </div>
                        </div>
                    ),
                },
            ]}
        />
    );
}

export default KbInternalForm;
