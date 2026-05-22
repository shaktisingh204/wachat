'use client';

import {
  Button,
  Card,
  ZoruCardContent,
  Skeleton,
  Badge,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Dialog,
  ZoruDialogContent,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogDescription,
  ZoruDialogFooter,
  Label,
  Input,
} from '@/components/zoruui';
import {
  FileText,
  Plus,
  Download,
  RefreshCw,
  Users,
  CheckCircle2,
  AlertTriangle,
  Settings as SettingsIcon,
  Loader2,
  } from 'lucide-react';

import * as React from 'react';
import Link from 'next/link';

import { AmBreadcrumb, AmHeader } from '@/app/dashboard/ad-manager/_components/am-page-shell';
import { useToast } from '@/hooks/use-toast';
import {
    getFacebookPagesForAdCreation,
    listLeadGenForms,
    getLeadsFromForm,
    getCrmLeadGenSyncStatus,
    syncLeadFormToCrm,
    type CrmLeadGenSyncStatus,
} from '@/app/actions/ad-manager.actions';
import type { FacebookPage } from '@/lib/definitions';

const CRM_FB_INTEGRATION_HREF = '/dashboard/crm/settings/integrations/facebook-ads';

export default function LeadFormsPage() {
    const { toast } = useToast();
    const [pages, setPages] = React.useState<FacebookPage[]>([]);
    const [selectedPage, setSelectedPage] = React.useState<string>('');
    const [forms, setForms] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [createOpen, setCreateOpen] = React.useState(false);
    const [crmStatus, setCrmStatus] = React.useState<CrmLeadGenSyncStatus | null>(null);
    const [syncingId, setSyncingId] = React.useState<string | null>(null);

    React.useEffect(() => {
        (async () => {
            const res = await getFacebookPagesForAdCreation();
            if (res.pages) {
                setPages(res.pages);
                if (res.pages.length > 0) setSelectedPage(res.pages[0].id);
            }
        })();
    }, []);

    const refreshCrmStatus = React.useCallback(async () => {
        const s = await getCrmLeadGenSyncStatus();
        setCrmStatus(s);
    }, []);

    React.useEffect(() => {
        refreshCrmStatus();
    }, [refreshCrmStatus]);

    React.useEffect(() => {
        if (!selectedPage) return;
        (async () => {
            setLoading(true);
            const res = await listLeadGenForms(selectedPage);
            setForms(res.data || []);
            setLoading(false);
        })();
    }, [selectedPage]);

    const selectedPageObj = pages.find((p) => p.id === selectedPage);
    const crmIsForSelectedPage =
        !!crmStatus?.configured && crmStatus.pageId === selectedPage;
    const crmIsForDifferentPage =
        !!crmStatus?.configured && !!crmStatus.pageId && crmStatus.pageId !== selectedPage;

    const syncToCrm = async (form: any) => {
        const pageAccessToken = (selectedPageObj as any)?.access_token as string | undefined;
        if (!pageAccessToken) {
            toast({
                title: 'Missing page access token',
                description: 'Reconnect this Facebook page in Ad Manager settings.',
                variant: 'destructive',
            });
            return;
        }
        if (crmIsForDifferentPage) {
            toast({
                title: 'Different page already wired',
                description: `CRM is connected to page ${crmStatus?.pageId}. Switch in CRM → Settings → Integrations → Facebook Ads.`,
                variant: 'destructive',
            });
            return;
        }

        setSyncingId(form.id);
        const res = await syncLeadFormToCrm({
            pageId: selectedPage,
            pageAccessToken,
            formId: form.id,
            formName: form.name,
        });
        setSyncingId(null);

        if (res.error) {
            toast({ title: 'Sync failed', description: res.error, variant: 'destructive' });
            return;
        }
        toast({
            title: 'Synced to CRM',
            description: `"${form.name}" now creates CRM leads in real-time. Configure mapping & routing in CRM settings.`,
        });
        refreshCrmStatus();
    };

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
                    <Button className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white" onClick={() => setCreateOpen(true)}>
                        <Plus className="h-4 w-4 mr-1" /> New lead form
                    </Button>
                }
            />

            <CrmConnectionBanner
                status={crmStatus}
                forSelectedPage={crmIsForSelectedPage}
                forDifferentPage={crmIsForDifferentPage}
                selectedPageName={selectedPageObj?.name}
            />

            <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Facebook page:</span>
                <Select value={selectedPage} onValueChange={setSelectedPage}>
                    <ZoruSelectTrigger className="w-[280px]">
                        <ZoruSelectValue placeholder="Select a page" />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                        {pages.map((p) => (
                            <ZoruSelectItem key={p.id} value={p.id}>{p.name}</ZoruSelectItem>
                        ))}
                    </ZoruSelectContent>
                </Select>
            </div>

            {/* Total leads count stat card */}
            {!loading && forms.length > 0 && (
                <Card>
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
                </Card>
            )}

            <Card>
                <ZoruCardContent className="p-0">
                    {loading ? (
                        <div className="p-4 space-y-2">
                            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
                        </div>
                    ) : (
                        <Table>
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
                                    forms.map((f) => {
                                        const isSynced =
                                            crmIsForSelectedPage &&
                                            !!crmStatus?.syncedFormIds.includes(f.id);
                                        const isSyncing = syncingId === f.id;
                                        return (
                                            <ZoruTableRow key={f.id}>
                                                <ZoruTableCell className="font-medium">
                                                    <div className="flex items-center gap-2">
                                                        {f.name}
                                                        {isSynced && (
                                                            <Badge variant="success" className="text-[10px]">
                                                                <CheckCircle2 className="mr-1 h-3 w-3" /> CRM synced
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <Badge variant="outline">{f.status}</Badge>
                                                </ZoruTableCell>
                                                <ZoruTableCell className="tabular-nums">{f.leads_count || 0}</ZoruTableCell>
                                                <ZoruTableCell className="text-xs text-muted-foreground">
                                                    {f.created_time
                                                        ? new Date(f.created_time).toLocaleDateString()
                                                        : '—'}
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <div className="flex items-center gap-1.5">
                                                        <Button size="sm" variant="outline" onClick={() => exportLeads(f.id)}>
                                                            <Download className="h-3 w-3 mr-1" /> Export
                                                        </Button>
                                                        {isSynced ? (
                                                            <Button size="sm" variant="outline" asChild>
                                                                <Link href={CRM_FB_INTEGRATION_HREF}>
                                                                    <SettingsIcon className="h-3 w-3 mr-1" /> Configure
                                                                </Link>
                                                            </Button>
                                                        ) : (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => syncToCrm(f)}
                                                                disabled={isSyncing || crmIsForDifferentPage}
                                                            >
                                                                {isSyncing ? (
                                                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                                                ) : (
                                                                    <RefreshCw className="h-3 w-3 mr-1" />
                                                                )}
                                                                Sync to CRM
                                                            </Button>
                                                        )}
                                                    </div>
                                                </ZoruTableCell>
                                            </ZoruTableRow>
                                        );
                                    })
                                )}
                            </ZoruTableBody>
                        </Table>
                    )}
                </ZoruCardContent>
            </Card>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
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
                        <Button asChild className="w-full bg-[#1877F2] hover:bg-[#1877F2]/90 text-white">
                            <a href="https://business.facebook.com/adsmanager" target="_blank" rel="noopener noreferrer">
                                Open Meta Ads Manager
                            </a>
                        </Button>
                    </div>
                    <ZoruDialogFooter>
                        <Button variant="outline" onClick={() => setCreateOpen(false)}>Close</Button>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </Dialog>
        </div>
    );
}

function CrmConnectionBanner({
    status,
    forSelectedPage,
    forDifferentPage,
    selectedPageName,
}: {
    status: CrmLeadGenSyncStatus | null;
    forSelectedPage: boolean;
    forDifferentPage: boolean;
    selectedPageName?: string;
}) {
    if (status === null) {
        return <Skeleton className="h-12 w-full" />;
    }

    if (!status.configured) {
        return (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-[13px] text-amber-700 dark:text-amber-300">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>
                        CRM lead-sync is not configured yet. Click "Sync to CRM" on any form below, or configure mapping & routing first.
                    </span>
                </div>
                <Button size="sm" variant="outline" asChild>
                    <Link href={CRM_FB_INTEGRATION_HREF}>
                        <SettingsIcon className="h-3 w-3 mr-1" /> Open CRM settings
                    </Link>
                </Button>
            </div>
        );
    }

    if (forDifferentPage) {
        return (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-[13px] text-amber-700 dark:text-amber-300">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>
                        CRM is wired to a different Facebook Page (<code className="font-mono text-[12px]">{status.pageId}</code>). Forms on{' '}
                        <strong>{selectedPageName || 'this page'}</strong> can't sync until you switch pages in CRM settings.
                    </span>
                </div>
                <Button size="sm" variant="outline" asChild>
                    <Link href={CRM_FB_INTEGRATION_HREF}>
                        <SettingsIcon className="h-3 w-3 mr-1" /> Switch in CRM
                    </Link>
                </Button>
            </div>
        );
    }

    if (forSelectedPage && !status.isActive) {
        return (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-[13px] text-amber-700 dark:text-amber-300">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>
                        CRM is wired to this page but lead sync is <strong>inactive</strong>. Enable it in CRM settings to resume real-time sync.
                    </span>
                </div>
                <Button size="sm" variant="outline" asChild>
                    <Link href={CRM_FB_INTEGRATION_HREF}>
                        <SettingsIcon className="h-3 w-3 mr-1" /> Activate
                    </Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-[13px] text-emerald-700 dark:text-emerald-300">
            <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>
                    Connected to CRM — {status.syncedFormIds.length} form{status.syncedFormIds.length === 1 ? '' : 's'} syncing in real-time.
                </span>
            </div>
            <Button size="sm" variant="outline" asChild>
                <Link href={CRM_FB_INTEGRATION_HREF}>
                    <SettingsIcon className="h-3 w-3 mr-1" /> Mapping & routing
                </Link>
            </Button>
        </div>
    );
}
