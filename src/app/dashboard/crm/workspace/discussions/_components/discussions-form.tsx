'use client';

import {
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  useActionState,
  useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { EntityFormShell } from '@/components/crm/entity-form-shell';

/**
 * Discussion form (§1D.3) — shared by /new and /[id]/edit. Preserves
 * FormData keys used by `saveDiscussion`: title, description, category_id.
 */

import * as React from 'react';

import {
    getDiscussionCategories,
    saveDiscussion,
} from '@/app/actions/worksuite/knowledge.actions';
import type {
    WsDiscussion,
    WsDiscussionCategory,
} from '@/lib/worksuite/knowledge-types';

export interface DiscussionsFormProps {
    mode: 'new' | 'edit';
    discussion?: (WsDiscussion & { _id: string }) | null;
}

export function DiscussionsForm({
    mode,
    discussion,
}: DiscussionsFormProps): React.JSX.Element {
    const router = useRouter();
    const { toast } = useZoruToast();
    const [state, formAction] = useActionState(saveDiscussion, {
        message: '',
        error: '',
    } as { message?: string; error?: string });
    const [categories, setCategories] = React.useState<
        (WsDiscussionCategory & { _id: string })[]
    >([]);

    useEffect(() => {
        getDiscussionCategories().then((c) =>
            setCategories(c as (WsDiscussionCategory & { _id: string })[]),
        );
    }, []);

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            router.push('/dashboard/crm/workspace/discussions');
        }
        if (state?.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router]);

    return (
        <EntityFormShell
            title={mode === 'edit' ? 'Edit discussion' : 'New discussion'}
            subtitle="Open a threaded conversation with your team."
            action={formAction}
            cancelHref="/dashboard/crm/workspace/discussions"
            submitLabel={mode === 'edit' ? 'Save changes' : 'Create discussion'}
            hiddenInputs={
                discussion?._id ? (
                    <input type="hidden" name="id" value={discussion._id} />
                ) : null
            }
            error={state?.error}
            message={state?.message}
            sections={[
                {
                    id: 'content',
                    title: 'Content',
                    description: 'Title, body, and category.',
                    children: (
                        <div className="grid gap-4">
                            <div>
                                <Label htmlFor="title">Title *</Label>
                                <Input
                                    id="title"
                                    name="title"
                                    required
                                    defaultValue={discussion?.title ?? ''}
                                    className="mt-1.5 h-10"
                                />
                            </div>
                            <div>
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                    id="description"
                                    name="description"
                                    rows={6}
                                    defaultValue={discussion?.description ?? ''}
                                    className="mt-1.5"
                                />
                            </div>
                            <div>
                                <Label htmlFor="category_id">Category</Label>
                                <Select
                                    name="category_id"
                                    defaultValue={discussion?.category_id ?? ''}
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
                                </Select>
                            </div>
                        </div>
                    ),
                },
            ]}
        />
    );
}

export default DiscussionsForm;
