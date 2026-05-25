'use client';

import { Button } from '@/components/zoruui';
import { useEffect, useState, useTransition, useMemo } from 'react';
import Link from 'next/link';

import { getLibraryTemplates } from '@/app/actions/template.actions';
import { bulkDeleteLibraryTemplates } from '@/app/actions/admin-hardening.actions';
import { bulkApproveLibraryTemplates, reorderLibraryTemplates } from './actions';
import { useToast } from '@/hooks/use-toast';
import type { LibraryTemplate as BaseLibraryTemplate } from '@/lib/definitions';
export type LibraryTemplate = BaseLibraryTemplate & { order?: number };
import { AdminTemplateCategoryManager } from '@/components/wabasimplify/admin-template-category-manager';
import { PlusCircle, BookCopy, Lock, LoaderCircle } from 'lucide-react';
import { TemplateTable } from './template-table';

export default function AdminTemplateLibraryPage() {
    const [templates, setTemplates] = useState<LibraryTemplate[]>([]);
    const [isLoading, startLoading] = useTransition();
    const { toast } = useToast();

    const fetchTemplates = () => {
        startLoading(async () => {
            try {
                const data = await getLibraryTemplates();
                if (data && Array.isArray(data)) {
                    setTemplates(data);
                } else {
                    toast({ title: 'Error', description: 'Failed to fetch templates.', variant: 'destructive' });
                    setTemplates([]);
                }
            } catch (e) {
                toast({ title: 'Error', description: 'Failed to load templates.', variant: 'destructive' });
                setTemplates([]);
            }
        });
    };

    useEffect(() => { fetchTemplates(); }, []);

    const { customTemplates, premadeTemplates } = useMemo(() => {
        const custom: LibraryTemplate[] = [];
        const premade: LibraryTemplate[] = [];
        templates.forEach(t => (t.isCustom ? custom : premade).push(t));
        premade.sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
        return { customTemplates: custom, premadeTemplates: premade };
    }, [templates]);

    const handleDelete = async (ids: string[]) => {
        const res = await bulkDeleteLibraryTemplates(ids);
        if (res.success) {
            toast({ title: 'Success', description: `Deleted ${res.deleted} templates.` });
            fetchTemplates();
        } else {
            toast({ title: 'Error', description: res.error || 'Failed to delete.', variant: 'destructive' });
        }
    };

    const handleApprove = async (ids: string[]) => {
        const res = await bulkApproveLibraryTemplates(ids);
        if (res.success) {
            toast({ title: 'Success', description: `Approved ${res.approved} templates to Pre-made.` });
            fetchTemplates();
        } else {
            toast({ title: 'Error', description: res.error || 'Failed to approve.', variant: 'destructive' });
        }
    };

    const handleReorder = async (reordered: LibraryTemplate[]) => {
        // Update local state first for optimistic UI
        setTemplates(prev => {
            const next = [...prev];
            const premadeOnly = reordered;
            // update orders
            premadeOnly.forEach((p, idx) => {
                const i = next.findIndex(n => n._id === p._id);
                if (i !== -1) {
                    next[i] = { ...next[i], order: idx };
                }
            });
            return next;
        });

        const ids = reordered.map(r => r._id!.toString());
        const res = await reorderLibraryTemplates(ids);
        if (!res.success) {
            toast({ title: 'Error', description: res.error || 'Failed to reorder.', variant: 'destructive' });
            fetchTemplates(); // revert on failure
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Template Library</h1>
                    <p className="text-sm text-slate-500 mt-1">Manage global templates available to all users.</p>
                </div>
                <Button asChild className="bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-lg shadow-amber-500/25">
                    <Link href="/admin/dashboard/template-library/create">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add Template
                    </Link>
                </Button>
            </div>

            {/* Category manager */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-sm font-semibold text-slate-900 mb-3">Category Manager</h2>
                <AdminTemplateCategoryManager />
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
                {/* Custom templates */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col min-w-0">
                    <div className="flex items-center gap-2 mb-4">
                        <BookCopy className="h-4 w-4 text-amber-600" />
                        <h2 className="font-semibold text-slate-900 text-sm">Custom Templates</h2>
                        <span className="ml-auto text-xs text-slate-500">{customTemplates.length} total</span>
                    </div>
                    {isLoading ? (
                        <div className="flex justify-center p-10"><LoaderCircle className="animate-spin text-slate-400 h-6 w-6" /></div>
                    ) : (
                        <TemplateTable
                            data={customTemplates}
                            type="custom"
                            onDeleteSelected={handleDelete}
                            onApproveSelected={handleApprove}
                        />
                    )}
                </div>

                {/* Pre-made templates */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col min-w-0">
                    <div className="flex items-center gap-2 mb-4">
                        <Lock className="h-4 w-4 text-slate-500" />
                        <h2 className="font-semibold text-slate-900 text-sm">Pre-made Templates</h2>
                        <span className="ml-auto text-xs text-slate-500">{premadeTemplates.length} total</span>
                    </div>
                    {isLoading ? (
                        <div className="flex justify-center p-10"><LoaderCircle className="animate-spin text-slate-400 h-6 w-6" /></div>
                    ) : (
                        <TemplateTable
                            data={premadeTemplates}
                            type="premade"
                            onDeleteSelected={handleDelete}
                            onReorder={handleReorder}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
