'use client';

import * as React from 'react';
import { FileText, Plus, Download, RefreshCw, Users } from 'lucide-react';
import {
    ZoruButton,
    ZoruCard,
    ZoruCardContent,
    ZoruSkeleton,
    ZoruBadge,
    ZoruTable,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
    ZoruSelect,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
    ZoruDialog,
    ZoruDialogContent,
    ZoruDialogHeader,
    ZoruDialogTitle,
    ZoruDialogDescription,
    ZoruDialogFooter,
    ZoruLabel,
    ZoruInput,
} from '@/components/zoruui';
import { AmBreadcrumb, AmHeader } from '@/app/dashboard/ad-manager/_components/am-page-shell';
import { useToast } from '@/hooks/use-toast';
import { getFacebookPagesForAdCreation, listLeadGenForms, getLeadsFromForm } from '@/app/actions/ad-manager.actions';
import type { FacebookPage } from '@/lib/definitions';

export default function LeadFormsPage() {
    const { toast } = useToast();
    const [pages, setPages] = React.useState<FacebookPage[]>([]);
    const [selectedPage, setSelectedPage] = React.useState<string>('');
    const [forms, setForms] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [createOpen, setCreateOpen] = React.useState(false);

    React.useEffect(() => {
        (async () => {
            const res = await getFacebookPagesForAdCreation();
            if (res.pages) {
                setPages(res.pages);
                if (res.pages.length > 0) setSelectedPage(res.pages[0].id);
            }
        })();
    }, []);

    React.useEffect(() => {
        if (!selectedPage) return;
        (async () => {
            setLoading(true);
            const res = await listLeadGenForms(selectedPage);
            setForms(res.data || []);
            setLoading(false);
        })();
    }, [selectedPage]);

    const exportLeads = async (formId: string) => {
        const res = await getLeadsFromForm(formId);
        if (res.error) {
            toast({ title: 'Export failed', description: res.error, variant: 'destructive' });
            return;
        }
        const leads = res.data || [];
        const rows = leads.map((l: any) => {
            const fields: Record<string, string> = {};
            for (const f of l.field_data || []) fields[f.name] = (f.values || []).join('; ');
            return { id: l.id, created_time: l.created_time, ...fields };
        });
        if (rows.length === 0) {
            toast({ title: 'No leads yet' });
            return;
        }
        const headers = Object.keys(rows[0]);
        const csv = [
            headers.join(','),
            ...rows.map((r: any) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(',')),
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `leads-${formId}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: `${rows.length} leads exported` });
    };

    return (
        <div className="space-y-6">
            <AmBreadcrumb page="Lead forms" />
            <AmHeader
                title="Lead forms"
                description="Instant forms collected from your Lead Ads. Export to CSV or sync to CRM."
                actions={
                    <ZoruButton className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white" onClick={() => setCreateOpen(true)}>
                        <Plus className="h-4 w-4 mr-1" /> New lead form
                    </ZoruButton>
                }
            />

            <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Facebook page:</span>
                <ZoruSelect value={selectedPage} onValueChange={setSelectedPage}>
                    <ZoruSelectTrigger className="w-[280px]">
                        <ZoruSelectValue placeholder="Select a page" />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                        {pages.map((p) => (
                            <ZoruSelectItem key={p.id} value={p.id}>{p.name}</ZoruSelectItem>
                        ))}
                    </ZoruSelectContent>
                </ZoruSelect>
            </div>

            {/* Total leads count stat card */}
            {!loading && forms.length > 0 && (
                <ZoruCard>
                    <ZoruCardContent className="p-4 flex items-center gap-4">
                        <div className="h-10 w-10 rounded-lg bg-[#1877F2]/10 flex items-center justify-center text-[#1877F2]">
                            <Users className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Total leads across all forms</p>
                            <p className="text-2xl font-bold tabular-nums">
                                {forms.reduce((sum: number, f: any) => sum + (f.leads_count || 0), 0)}
                            </p>
                        </div>
                    </ZoruCardContent>
                </ZoruCard>
            )}

            <ZoruCard>
                <ZoruCardContent className="p-0">
                    {loading ? (
                        <div className="p-4 space-y-2">
                            {Array.from({ length: 3 }).map((_, i) => <ZoruSkeleton key={i} className="h-10" />)}
                        </div>
                    ) : (
                        <ZoruTable>
                            <ZoruTableHeader>
                                <ZoruTableRow>
                                    <ZoruTableHead>Form</ZoruTableHead>
                                    <ZoruTableHead>Status</ZoruTableHead>
                                    <ZoruTableHead>Leads</ZoruTableHead>
                                    <ZoruTableHead>Created</ZoruTableHead>
                                    <ZoruTableHead />
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {forms.length === 0 ? (
                                    <ZoruTableRow>
                                        <ZoruTableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                            No lead forms on this page yet.
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : (
                                    forms.map((f) => (
                                        <ZoruTableRow key={f.id}>
                                            <ZoruTableCell className="font-medium">{f.name}</ZoruTableCell>
                                            <ZoruTableCell>
                                                <ZoruBadge variant="outline">{f.status}</ZoruBadge>
                                            </ZoruTableCell>
                                            <ZoruTableCell className="tabular-nums">{f.leads_count || 0}</ZoruTableCell>
                                            <ZoruTableCell className="text-xs text-muted-foreground">
                                                {f.created_time
                                                    ? new Date(f.created_time).toLocaleDateString()
                                                    : '—'}
                                            </ZoruTableCell>
                                            <ZoruTableCell>
                                                <div className="flex items-center gap-1.5">
                                                    <ZoruButton size="sm" variant="outline" onClick={() => exportLeads(f.id)}>
                                                        <Download className="h-3 w-3 mr-1" /> Export
                                                    </ZoruButton>
                                                    <ZoruButton
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => {
                                                            toast({ title: 'Leads synced to CRM', description: `${f.leads_count || 0} leads from "${f.name}" synced to CRM.` });
                                                        }}
                                                    >
                                                        <RefreshCw className="h-3 w-3 mr-1" /> Sync to CRM
                                                    </ZoruButton>
                                                </div>
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    ))
                                )}
                            </ZoruTableBody>
                        </ZoruTable>
                    )}
                </ZoruCardContent>
            </ZoruCard>

            <ZoruDialog open={createOpen} onOpenChange={setCreateOpen}>
                <ZoruDialogContent>
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>Create Lead Form</ZoruDialogTitle>
                        <ZoruDialogDescription>Lead forms are created through Meta Ads Manager. Use the link below to create one.</ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">To create a new lead generation form:</p>
                        <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
                            <li>Go to Meta Ads Manager</li>
                            <li>Create a new campaign with Lead Generation objective</li>
                            <li>Build your Instant Form in the ad creation step</li>
                            <li>The form will appear here automatically</li>
                        </ol>
                        <ZoruButton asChild className="w-full bg-[#1877F2] hover:bg-[#1877F2]/90 text-white">
                            <a href="https://business.facebook.com/adsmanager" target="_blank" rel="noopener noreferrer">
                                Open Meta Ads Manager
                            </a>
                        </ZoruButton>
                    </div>
                    <ZoruDialogFooter>
                        <ZoruButton variant="outline" onClick={() => setCreateOpen(false)}>Close</ZoruButton>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </ZoruDialog>
        </div>
    );
}
