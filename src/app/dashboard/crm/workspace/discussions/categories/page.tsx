'use client';

import {
  ZoruBadge,
  ZoruButton,
  ZoruDialog,
  ZoruDialogClose,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
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
  ArrowLeft,
  Folder,
  Plus,
  Trash2 } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';

/**
 * Discussion Categories — settings-style list (§1D.4 specialized).
 *
 * Inline-create dialog with fields: name, color, description, parent
 * (self-reference). The extra fields (`color`, `description`, `parent`)
 * are passed through as FormData keys; `saveDiscussionCategory` accepts
 * any keys via genericSave, so they round-trip into the document.
 */

import * as React from 'react';
import Link from 'next/link';

import {
    deleteDiscussionCategory,
    getDiscussionCategories,
    saveDiscussionCategory,
} from '@/app/actions/worksuite/knowledge.actions';
import type { WsDiscussionCategory } from '@/lib/worksuite/knowledge-types';

type CategoryRow = WsDiscussionCategory & {
    _id: string;
    color?: string;
    description?: string;
    parent?: string;
};

export default function DiscussionCategoriesPage() {
    const { toast } = useZoruToast();
    const [rows, setRows] = React.useState<CategoryRow[]>([]);
    const [loading, startTransition] = React.useTransition();
    const [open, setOpen] = React.useState(false);
    const [editing, setEditing] = React.useState<CategoryRow | null>(null);
    const [deleteId, setDeleteId] = React.useState<string | null>(null);

    const refresh = React.useCallback(() => {
        startTransition(async () => {
            const r = (await getDiscussionCategories()) as CategoryRow[];
            setRows(r);
        });
    }, []);

    React.useEffect(() => {
        refresh();
    }, [refresh]);

    const handleSubmit = async (formData: FormData) => {
        if (editing?._id) formData.set('id', editing._id);
        const res = await saveDiscussionCategory(null, formData);
        if (res.message) {
            toast({ title: 'Saved' });
            setOpen(false);
            setEditing(null);
            refresh();
        } else if (res.error) {
            toast({ title: 'Error', description: res.error, variant: 'destructive' });
        }
    };

    const handleConfirmDelete = async () => {
        if (!deleteId) return;
        const r = await deleteDiscussionCategory(deleteId);
        if (r.success) {
            toast({ title: 'Deleted' });
            refresh();
        } else {
            toast({ title: 'Error', description: r.error, variant: 'destructive' });
        }
        setDeleteId(null);
    };

    return (
        <div className="flex w-full flex-col gap-6 p-4 md:p-6">
            <EntityListShell
                title="Discussion categories"
                subtitle="Group discussions by topic. Categories can nest under a parent."
                primaryAction={
                    <ZoruDialog open={open} onOpenChange={(o) => {
                        setOpen(o);
                        if (!o) setEditing(null);
                    }}>
                        <ZoruDialogTrigger asChild>
                            <ZoruButton>
                                <Plus className="h-4 w-4" /> New category
                            </ZoruButton>
                        </ZoruDialogTrigger>
                        <ZoruDialogContent>
                            <ZoruDialogHeader>
                                <ZoruDialogTitle>
                                    {editing ? 'Edit category' : 'New category'}
                                </ZoruDialogTitle>
                                <ZoruDialogDescription>
                                    Group discussions by topic. Set a colour for quick visual
                                    grouping in the kanban.
                                </ZoruDialogDescription>
                            </ZoruDialogHeader>
                            <form action={handleSubmit} className="grid gap-3">
                                <div>
                                    <ZoruLabel htmlFor="name">Name *</ZoruLabel>
                                    <ZoruInput
                                        id="name"
                                        name="name"
                                        required
                                        defaultValue={editing?.name ?? ''}
                                        className="mt-1.5 h-10"
                                    />
                                </div>
                                <div className="grid gap-3 md:grid-cols-2">
                                    <div>
                                        <ZoruLabel htmlFor="color">Colour</ZoruLabel>
                                        <ZoruInput
                                            id="color"
                                            name="color"
                                            type="color"
                                            defaultValue={editing?.color ?? '#3b82f6'}
                                            className="mt-1.5 h-10 w-full"
                                        />
                                    </div>
                                    <div>
                                        <ZoruLabel htmlFor="parent">Parent</ZoruLabel>
                                        <ZoruSelect
                                            name="parent"
                                            defaultValue={editing?.parent ?? ''}
                                        >
                                            <ZoruSelectTrigger id="parent" className="mt-1.5 h-10">
                                                <ZoruSelectValue placeholder="None" />
                                            </ZoruSelectTrigger>
                                            <ZoruSelectContent>
                                                <ZoruSelectItem value="">None</ZoruSelectItem>
                                                {rows
                                                    .filter((r) => r._id !== editing?._id)
                                                    .map((c) => (
                                                        <ZoruSelectItem key={c._id} value={c._id}>
                                                            {c.name}
                                                        </ZoruSelectItem>
                                                    ))}
                                            </ZoruSelectContent>
                                        </ZoruSelect>
                                    </div>
                                </div>
                                <div>
                                    <ZoruLabel htmlFor="description">Description</ZoruLabel>
                                    <ZoruTextarea
                                        id="description"
                                        name="description"
                                        rows={3}
                                        defaultValue={editing?.description ?? ''}
                                        className="mt-1.5"
                                    />
                                </div>
                                <ZoruDialogFooter>
                                    <ZoruDialogClose asChild>
                                        <ZoruButton variant="ghost" type="button">
                                            Cancel
                                        </ZoruButton>
                                    </ZoruDialogClose>
                                    <ZoruButton type="submit">
                                        {editing ? 'Save changes' : 'Create'}
                                    </ZoruButton>
                                </ZoruDialogFooter>
                            </form>
                        </ZoruDialogContent>
                    </ZoruDialog>
                }
                loading={loading && rows.length === 0}
                empty={
                    !loading && rows.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 p-4">
                            <Folder className="h-5 w-5 text-zoru-ink-muted" />
                            <p className="text-sm text-zoru-ink-muted">
                                No categories yet — click <strong>New category</strong> above.
                            </p>
                        </div>
                    ) : null
                }
            >
                <div className="flex justify-end pb-2">
                    <Link
                        href="/dashboard/crm/workspace/discussions"
                        className="inline-flex items-center gap-1 text-[12.5px] text-zoru-ink-muted hover:underline"
                    >
                        <ArrowLeft className="h-3 w-3" /> Back to discussions
                    </Link>
                </div>
                <div className="overflow-x-auto rounded-[var(--zoru-radius-lg)] border border-zoru-line">
                    <table className="w-full min-w-[600px] text-[13px]">
                        <thead className="bg-zoru-surface-2 text-zoru-ink-muted">
                            <tr>
                                {['Name', 'Colour', 'Parent', 'Description', ''].map((h) => (
                                    <th key={h} className="px-3 py-2 text-left font-medium">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zoru-line bg-zoru-bg">
                            {rows.map((r) => {
                                const parent = rows.find((x) => x._id === r.parent);
                                return (
                                    <tr key={r._id} className="hover:bg-zoru-surface">
                                        <td className="px-3 py-2 font-medium text-zoru-ink">
                                            {r.name}
                                        </td>
                                        <td className="px-3 py-2">
                                            {r.color ? (
                                                <span className="inline-flex items-center gap-2">
                                                    <span
                                                        className="inline-block h-4 w-4 rounded-full border border-zoru-line"
                                                        style={{ backgroundColor: r.color }}
                                                    />
                                                    <span className="text-[12px] text-zoru-ink-muted">
                                                        {r.color}
                                                    </span>
                                                </span>
                                            ) : (
                                                <span className="text-zoru-ink-muted">—</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2">
                                            {parent ? (
                                                <ZoruBadge variant="ghost">{parent.name}</ZoruBadge>
                                            ) : (
                                                <span className="text-zoru-ink-muted">—</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-zoru-ink-muted">
                                            {r.description || '—'}
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            <ZoruButton
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    setEditing(r);
                                                    setOpen(true);
                                                }}
                                            >
                                                Edit
                                            </ZoruButton>
                                            <ZoruButton
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setDeleteId(r._id)}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </ZoruButton>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </EntityListShell>

            <ConfirmDialog
                open={!!deleteId}
                onOpenChange={(o) => !o && setDeleteId(null)}
                title="Delete this category?"
                description="Discussions in this category won’t be deleted, but will become uncategorized."
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={handleConfirmDelete}
            />
        </div>
    );
}
