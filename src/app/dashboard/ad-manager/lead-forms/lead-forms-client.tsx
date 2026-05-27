'use client';

import * as React from 'react';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
  Input,
  Checkbox,
  Switch,
  Label,
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
  Search,
} from 'lucide-react';
import { AmBreadcrumb, AmHeader } from '@/app/dashboard/ad-manager/_components/am-page-shell';
import { useToast } from '@/hooks/use-toast';
import {
  listLeadGenForms,
  getLeadsFromForm,
  getCrmLeadGenSyncStatus,
  syncLeadFormToCrm,
  type CrmLeadGenSyncStatus,
} from '@/app/actions/ad-manager.actions';
import type { FacebookPage } from '@/lib/definitions';

const CRM_FB_INTEGRATION_HREF = '/dashboard/crm/settings/integrations/facebook-ads';

const filterSchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  liveMode: z.boolean().default(false),
});
type FilterValues = z.infer<typeof filterSchema>;

export default function LeadFormsClient({
  initialPages,
  initialForms,
  initialSelectedPage,
  initialCrmStatus,
}: {
  initialPages: FacebookPage[];
  initialForms: any[];
  initialSelectedPage: string;
  initialCrmStatus: CrmLeadGenSyncStatus | null;
}) {
  const { toast } = useToast();
  const [pages] = React.useState<FacebookPage[]>(initialPages);
  const [selectedPage, setSelectedPage] = React.useState<string>(initialSelectedPage);
  const [forms, setForms] = React.useState<any[]>(initialForms);
  const [loading, setLoading] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [crmStatus, setCrmStatus] = React.useState<CrmLeadGenSyncStatus | null>(initialCrmStatus);
  const [syncingId, setSyncingId] = React.useState<string | null>(null);
  
  // Bulk selection state
  const [selectedForms, setSelectedForms] = React.useState<string[]>([]);

  const { control, watch, setValue } = useForm<FilterValues>({
    resolver: zodResolver(filterSchema),
    defaultValues: {
      search: '',
      status: 'all',
      liveMode: false,
    },
  });
  
  const search = watch('search');
  const statusFilter = watch('status');
  const liveMode = watch('liveMode');

  const refreshCrmStatus = React.useCallback(async () => {
    const s = await getCrmLeadGenSyncStatus();
    setCrmStatus(s);
  }, []);

  const fetchForms = React.useCallback(async (pageId: string, showLoading = true) => {
    if (!pageId) return;
    if (showLoading) setLoading(true);
    const res = await listLeadGenForms(pageId);
    setForms(res.data || []);
    if (showLoading) setLoading(false);
  }, []);

  // Effect for handling page change manually
  React.useEffect(() => {
    if (selectedPage && selectedPage !== initialSelectedPage) {
      fetchForms(selectedPage, true);
    }
  }, [selectedPage, fetchForms, initialSelectedPage]);

  // Real-time updates via WebSockets for events and logs (Simulated with polling)
  React.useEffect(() => {
    if (!liveMode || !selectedPage) return;
    
    const interval = setInterval(() => {
      fetchForms(selectedPage, false);
      refreshCrmStatus();
    }, 15000);
    
    return () => clearInterval(interval);
  }, [liveMode, selectedPage, fetchForms, refreshCrmStatus]);

  const selectedPageObj = pages.find((p) => p.id === selectedPage);
  const crmIsForSelectedPage = !!crmStatus?.configured && crmStatus.pageId === selectedPage;
  const crmIsForDifferentPage = !!crmStatus?.configured && !!crmStatus.pageId && crmStatus.pageId !== selectedPage;

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

  const performExport = (leads: any[], formId: string) => {
    const rows = leads.map((l: any) => {
      const fields: Record<string, string> = {};
      for (const f of l.field_data || []) fields[f.name] = (f.values || []).join('; ');
      return { id: l.id, created_time: l.created_time, form_id: formId, ...fields };
    });
    return rows;
  };

  const exportLeads = async (formId: string) => {
    const res = await getLeadsFromForm(formId);
    if (res.error) {
      toast({ title: 'Export failed', description: res.error, variant: 'destructive' });
      return;
    }
    const leads = res.data || [];
    const rows = performExport(leads, formId);
    
    if (rows.length === 0) {
      toast({ title: 'No leads yet' });
      return;
    }
    downloadCsv(rows, `leads-${formId}.csv`);
    toast({ title: `${rows.length} leads exported` });
  };

  const exportSelectedForms = async () => {
    if (selectedForms.length === 0) return;
    toast({ title: 'Exporting...', description: 'Gathering leads for selected forms.' });
    
    let allRows: any[] = [];
    for (const formId of selectedForms) {
      const res = await getLeadsFromForm(formId);
      if (res.data) {
        allRows = allRows.concat(performExport(res.data, formId));
      }
    }
    
    if (allRows.length === 0) {
      toast({ title: 'No leads found in selected forms' });
      return;
    }
    
    downloadCsv(allRows, `bulk-leads-export.csv`);
    toast({ title: `${allRows.length} leads exported in bulk` });
  };
  
  const downloadCsv = (rows: any[], filename: string) => {
    const headers = Array.from(new Set(rows.flatMap(Object.keys)));
    const csv = [
      headers.join(','),
      ...rows.map((r: any) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedForms(filteredForms.map((f) => f.id));
    } else {
      setSelectedForms([]);
    }
  };

  const toggleSelectForm = (id: string) => {
    setSelectedForms((prev) => 
      prev.includes(id) ? prev.filter(fId => fId !== id) : [...prev, id]
    );
  };

  // Filter forms based on search and status
  const filteredForms = React.useMemo(() => {
    return forms.filter(f => {
      const matchesSearch = !search || f.name?.toLowerCase().includes(search.toLowerCase()) || f.id.includes(search);
      const matchesStatus = !statusFilter || statusFilter === 'all' || f.status?.toLowerCase() === statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [forms, search, statusFilter]);

  // Safe date formatter for client components to prevent hydration mismatches
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      // Create a stable string representation
      const date = new Date(dateStr);
      return date.toISOString().split('T')[0];
    } catch {
      return '—';
    }
  };

  return (
    <div className="space-y-6">
      <AmBreadcrumb page="Lead forms" />
      <AmHeader
        title="Lead forms"
        description="Instant forms collected from your Lead Ads. Export to CSV or sync to CRM."
        actions={
          <Button className="bg-zoru-ink hover:bg-zoru-ink/90 text-white" onClick={() => setCreateOpen(true)}>
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

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-zoru-ink-muted" />
          <span className="text-sm text-zoru-ink-muted whitespace-nowrap">Facebook page:</span>
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
        
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2">
            <Controller
              name="liveMode"
              control={control}
              render={({ field }) => (
                <Switch
                  id="live-mode"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Label htmlFor="live-mode" className="text-sm text-zoru-ink-muted cursor-pointer">Live Updates</Label>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {!loading && forms.length > 0 && (
          <Card>
            <ZoruCardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-zoru-ink/10 flex items-center justify-center text-zoru-ink">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-zoru-ink-muted">Total leads across all forms</p>
                <p className="text-2xl font-bold tabular-nums">
                  {forms.reduce((sum: number, f: any) => sum + (f.leads_count || 0), 0)}
                </p>
              </div>
            </ZoruCardContent>
          </Card>
        )}
        
        <Card className="md:col-span-2">
          <ZoruCardContent className="p-4 flex flex-col sm:flex-row items-center gap-3 h-full">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zoru-ink-muted" />
              <Controller
                name="search"
                control={control}
                render={({ field }) => (
                  <Input 
                    type="search"
                    placeholder="Search forms by name or ID..." 
                    className="pl-9 bg-zoru-surface w-full"
                    {...field}
                  />
                )}
              />
            </div>
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <ZoruSelectTrigger className="w-full sm:w-[150px]">
                    <ZoruSelectValue placeholder="Status" />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="all">All Status</ZoruSelectItem>
                    <ZoruSelectItem value="ACTIVE">Active</ZoruSelectItem>
                    <ZoruSelectItem value="DRAFT">Draft</ZoruSelectItem>
                    <ZoruSelectItem value="PAUSED">Paused</ZoruSelectItem>
                    <ZoruSelectItem value="ARCHIVED">Archived</ZoruSelectItem>
                  </ZoruSelectContent>
                </Select>
              )}
            />
          </ZoruCardContent>
        </Card>
      </div>
      
      {selectedForms.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-zoru-surface-2/50 border rounded-lg animate-in fade-in slide-in-from-top-2">
          <span className="text-sm font-medium">{selectedForms.length} form(s) selected</span>
          <Button size="sm" variant="outline" onClick={exportSelectedForms}>
            <Download className="h-4 w-4 mr-2" />
            Bulk Export Leads
          </Button>
        </div>
      )}

      <Card>
        <ZoruCardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : (
            <Table>
              <ZoruTableHeader>
                <ZoruTableRow>
                  <ZoruTableHead className="w-[50px]">
                    <Checkbox 
                      checked={filteredForms.length > 0 && selectedForms.length === filteredForms.length}
                      onCheckedChange={(checked) => handleSelectAll(!!checked)}
                      aria-label="Select all"
                    />
                  </ZoruTableHead>
                  <ZoruTableHead>Form</ZoruTableHead>
                  <ZoruTableHead>Status</ZoruTableHead>
                  <ZoruTableHead>Leads</ZoruTableHead>
                  <ZoruTableHead>Created</ZoruTableHead>
                  <ZoruTableHead />
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {filteredForms.length === 0 ? (
                  <ZoruTableRow>
                    <ZoruTableCell colSpan={6} className="h-24 text-center text-zoru-ink-muted">
                      No lead forms found.
                    </ZoruTableCell>
                  </ZoruTableRow>
                ) : (
                  filteredForms.map((f) => {
                    const isSynced = crmIsForSelectedPage && !!crmStatus?.syncedFormIds.includes(f.id);
                    const isSyncing = syncingId === f.id;
                    const isSelected = selectedForms.includes(f.id);
                    
                    return (
                      <ZoruTableRow key={f.id} data-state={isSelected ? "selected" : undefined}>
                        <ZoruTableCell>
                          <Checkbox 
                            checked={isSelected}
                            onCheckedChange={() => toggleSelectForm(f.id)}
                            aria-label={`Select form ${f.name}`}
                          />
                        </ZoruTableCell>
                        <ZoruTableCell className="font-medium">
                          <div className="flex flex-col gap-1">
                            <span className="truncate max-w-[200px] sm:max-w-[300px]">{f.name}</span>
                            <span className="text-[10px] text-zoru-ink-muted font-mono">{f.id}</span>
                            {isSynced && (
                              <Badge variant="success" className="text-[10px] w-fit mt-1">
                                <CheckCircle2 className="mr-1 h-3 w-3" /> CRM synced
                              </Badge>
                            )}
                          </div>
                        </ZoruTableCell>
                        <ZoruTableCell>
                          <Badge variant="outline">{f.status}</Badge>
                        </ZoruTableCell>
                        <ZoruTableCell className="tabular-nums font-medium">{f.leads_count || 0}</ZoruTableCell>
                        <ZoruTableCell className="text-xs text-zoru-ink-muted whitespace-nowrap">
                          {formatDate(f.created_time)}
                        </ZoruTableCell>
                        <ZoruTableCell>
                          <div className="flex flex-wrap items-center gap-1.5 justify-end">
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
            <p className="text-sm text-zoru-ink-muted">To create a new lead generation form:</p>
            <ol className="text-sm space-y-2 list-decimal list-inside text-zoru-ink-muted">
              <li>Go to Meta Ads Manager</li>
              <li>Create a new campaign with Lead Generation objective</li>
              <li>Build your Instant Form in the ad creation step</li>
              <li>The form will appear here automatically</li>
            </ol>
            <Button asChild className="w-full bg-zoru-ink hover:bg-zoru-ink/90 text-white">
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
      <div className="flex items-center justify-between gap-3 rounded-lg border border-zoru-line/40 bg-zoru-ink/10 px-4 py-2.5 text-[13px] text-zoru-ink dark:text-zoru-ink-muted">
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
      <div className="flex items-center justify-between gap-3 rounded-lg border border-zoru-line/40 bg-zoru-ink/10 px-4 py-2.5 text-[13px] text-zoru-ink dark:text-zoru-ink-muted">
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
      <div className="flex items-center justify-between gap-3 rounded-lg border border-zoru-line/40 bg-zoru-ink/10 px-4 py-2.5 text-[13px] text-zoru-ink dark:text-zoru-ink-muted">
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
    <div className="flex items-center justify-between gap-3 rounded-lg border border-zoru-line/40 bg-zoru-ink/10 px-4 py-2.5 text-[13px] text-zoru-ink dark:text-zoru-ink-muted">
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
