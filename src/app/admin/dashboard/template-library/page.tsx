'use client';

import { useEffect, useState, useTransition, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getLibraryTemplates } from '@/app/actions/template.actions';
import type { LibraryTemplate } from '@/lib/definitions';
import { AdminDeleteLibraryTemplateButton } from '@/components/wabasimplify/admin-delete-library-template-button';
import { AdminTemplateCategoryManager } from '@/components/wabasimplify/admin-template-category-manager';
import { PlusCircle, BookCopy, Lock, Trash2 } from 'lucide-react';

export default function AdminTemplateLibraryPage() {
    const [templates, setTemplates] = useState<LibraryTemplate[]>([]);
    const [isLoading, startLoading] = useTransition();

    const fetchTemplates = () => {
        startLoading(async () => {
            const data = await getLibraryTemplates();
            setTemplates(data);
        });
    };

    useEffect(() => { fetchTemplates(); }, []);

    const { customTemplates, premadeTemplates } = useMemo(() => {
        const custom: LibraryTemplate[] = [];
        const premade: LibraryTemplate[] = [];
        templates.forEach(t => (t.isCustom ? custom : premade).push(t));
        return { customTemplates: custom, premadeTemplates: premade };
    }, [templates]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Template Library</h1>
                    <p className="text-sm text-slate-500 mt-1">Manage global templates available to all users.</p>
                </div>
                <Button asChild className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold shadow-lg shadow-amber-500/25">
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

            <div className="grid gap-5 lg:grid-cols-2">
                {/* Custom templates */}
                <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
                        <BookCopy className="h-4 w-4 text-amber-600" />
                        <h2 className="font-semibold text-slate-900 text-sm">Custom Templates</h2>
                        <span className="ml-auto text-xs text-slate-500">{customTemplates.length} total</span>
                    </div>
                    <div className="divide-y divide-slate-200">
                        {isLoading ? (
                            [...Array(3)].map((_, i) => (
                                <div key={i} className="px-6 py-3 flex gap-3">
                                    <div className="h-4 flex-1 rounded bg-slate-100 animate-pulse" />
                                </div>
                            ))
                        ) : customTemplates.length > 0 ? (
                            customTemplates.map(t => (
                                <div key={t._id?.toString()} className="px-6 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-slate-900 truncate">{t.name}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                                                {t.category}
                                            </span>
                                            <span className="text-[10px] text-slate-500">{t.language}</span>
                                        </div>
                                    </div>
                                    <AdminDeleteLibraryTemplateButton templateId={t._id!.toString()} templateName={t.name} />
                                </div>
                            ))
                        ) : (
                            <div className="px-6 py-10 text-center text-slate-500 text-sm">
                                No custom templates added yet.
                            </div>
                        )}
                    </div>
                </div>

                {/* Pre-made templates */}
                <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
                        <Lock className="h-4 w-4 text-slate-500" />
                        <h2 className="font-semibold text-slate-900 text-sm">Pre-made Templates</h2>
                        <span className="ml-auto text-xs text-slate-500">{premadeTemplates.length} total</span>
                    </div>
                    <div className="divide-y divide-slate-200 max-h-96 overflow-y-auto">
                        {isLoading ? (
                            [...Array(4)].map((_, i) => (
                                <div key={i} className="px-6 py-3">
                                    <div className="h-4 rounded bg-slate-100 animate-pulse" />
                                </div>
                            ))
                        ) : premadeTemplates.map((t, i) => (
                            <div key={i} className="px-6 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-slate-900 truncate">{t.name}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                                            {t.category}
                                        </span>
                                        <span className="text-[10px] text-slate-500">{t.language}</span>
                                    </div>
                                </div>
                                <Lock className="h-3 w-3 text-slate-400 shrink-0" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
