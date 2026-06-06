'use client';

import * as React from 'react';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Button,
  Card,
  CardBody,
  Skeleton,
  Badge,
  StatCard,
  EmptyState,
  Alert,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  Input,
  Checkbox,
  Switch,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  FileText,
  Plus,
  Download,
  RefreshCw,
  Users,
  CheckCircle2,
  AlertTriangle,
  Settings as SettingsIcon,
  Search,
  type LucideIcon,
} from 'lucide-react';
import { AmBreadcrumb, AmHeader } from '@/app/dashboard/ad-manager/_components/am-page-shell';
import {
  listLeadGenForms,
  getLeadsFromForm,
  getCrmLeadGenSyncStatus,
  syncLeadFormToCrm,
} from '@/app/actions/ad-manager.actions';
import type { FacebookPage } from '@/lib/definitions';

// `CrmLeadGenSyncStatus` is not exported from the actions module; derive it from
// the server action's resolved return type so the component stays in sync.
type CrmLeadGenSyncStatus = Awaited<ReturnType<typeof getCrmLeadGenSyncStatus>>;

const CRM_FB_INTEGRATION_HREF = '/dashboard/crm/settings/integrations/facebook-ads';

const filterSchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  liveMode: z.boolean().default(false),
});
type FilterValues = z.infer<typeof filterSchema>;

/**
 * A `next/link` styled as a 20ui Button. The 20ui `Button` is a native
 * `<button>` (no `asChild`), so link-as-button uses the system's own `u-btn`
 * classes plus an optional leading lucide icon.
 */
function LinkButton({
  href,
  icon: Icon,
  children,
  size = 'sm',
  variant = 'outline',
  className,
}: {
  href: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  className?: string;
}) {
  const cls = ['u-btn', `u-btn--${variant}`, `u-btn--${size}`, className].filter(Boolean).join(' ');
  const iconSize = size === 'sm' ? 13 : size === 'lg' ? 16 : 14;
  return (
    <Link href={href} className={cls}>
      {Icon ? <Icon size={iconSize} aria-hidden="true" /> : null}
      <span className="u-btn__label">{children}</span>
    </Link>
  );
}

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

  const { control, watch } = useForm<FilterValues>({
    resolver: zodResolver(filterSchema) as never,
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
        tone: 'danger',
      });
      return;
    }
    if (crmIsForDifferentPage) {
      toast({
        title: 'Different page already wired',
        description: `CRM is connected to page ${crmStatus?.pageId}. Switch in CRM, Settings, Integrations, Facebook Ads.`,
        tone: 'danger',
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
      toast({ title: 'Sync failed', description: res.error, tone: 'danger' });
      return;
    }
    toast({
      title: 'Synced to CRM',
      description: `"${form.name}" now creates CRM leads in real-time. Configure mapping and routing in CRM settings.`,
      tone: 'success',
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
      toast({ title: 'Export failed', description: res.error, tone: 'danger' });
      return;
    }
    const leads = res.data || [];
    const rows = performExport(leads, formId);

    if (rows.length === 0) {
      toast.info('No leads yet');
      return;
    }
    downloadCsv(rows, `leads-${formId}.csv`);
    toast.success(`${rows.length} leads exported`);
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
      toast.info('No leads found in selected forms');
      return;
    }

    downloadCsv(allRows, `bulk-leads-export.csv`);
    toast.success(`${allRows.length} leads exported in bulk`);
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
      prev.includes(id) ? prev.filter((fId) => fId !== id) : [...prev, id]
    );
  };

  // Filter forms based on search and status
  const filteredForms = React.useMemo(() => {
    return forms.filter((f) => {
      const matchesSearch = !search || f.name?.toLowerCase().includes(search.toLowerCase()) || f.id.includes(search);
      const matchesStatus = !statusFilter || statusFilter === 'all' || f.status?.toLowerCase() === statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [forms, search, statusFilter]);

  // Safe date formatter for client components to prevent hydration mismatches
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      // Create a stable string representation
      const date = new Date(dateStr);
      return date.toISOString().split('T')[0];
    } catch {
      return '-';
    }
  };

  const totalLeads = forms.reduce((sum: number, f: any) => sum + (f.leads_count || 0), 0);

  return (
    <div className="space-y-6">
      <AmBreadcrumb page="Lead forms" />
      <AmHeader
        title="Lead forms"
        description="Instant forms collected from your Lead Ads. Export to CSV or sync to CRM."
        actions={
          <Button variant="primary" iconLeft={Plus} onClick={() => setCreateOpen(true)}>
            New lead form
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
          <FileText className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
          <span className="text-sm text-[var(--st-text-secondary)] whitespace-nowrap">Facebook page:</span>
          <Select value={selectedPage} onValueChange={setSelectedPage}>
            <SelectTrigger className="w-[280px]" aria-label="Facebook page">
              <SelectValue placeholder="Select a page" />
            </SelectTrigger>
            <SelectContent>
              {pages.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Controller
          name="liveMode"
          control={control}
          render={({ field }) => (
            <Switch
              checked={field.value}
              onCheckedChange={field.onChange}
              label="Live updates"
            />
          )}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {!loading && forms.length > 0 && (
          <StatCard
            label="Total leads across all forms"
            value={<span className="tabular-nums">{totalLeads}</span>}
            icon={Users}
            accent="var(--st-text)"
          />
        )}

        <Card padding="sm" className="md:col-span-2">
          <CardBody className="flex flex-col sm:flex-row items-center gap-3 h-full">
            <div className="flex-1 w-full">
              <Controller
                name="search"
                control={control}
                render={({ field }) => (
                  <Input
                    type="search"
                    placeholder="Search forms by name or ID..."
                    iconLeft={Search}
                    aria-label="Search lead forms"
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
                  <SelectTrigger className="w-full sm:w-[150px]" aria-label="Filter by status">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All status</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="PAUSED">Paused</SelectItem>
                    <SelectItem value="ARCHIVED">Archived</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </CardBody>
        </Card>
      </div>

      {selectedForms.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3 animate-in fade-in slide-in-from-top-2">
          <span className="text-sm font-medium text-[var(--st-text)]">{selectedForms.length} form(s) selected</span>
          <Button size="sm" variant="outline" iconLeft={Download} onClick={exportSelectedForms}>
            Bulk export leads
          </Button>
        </div>
      )}

      <Card padding="none">
        <CardBody className="overflow-x-auto">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={40} />)}
            </div>
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th width={50}>
                    <Checkbox
                      checked={filteredForms.length > 0 && selectedForms.length === filteredForms.length}
                      indeterminate={selectedForms.length > 0 && selectedForms.length < filteredForms.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      aria-label="Select all forms"
                    />
                  </Th>
                  <Th>Form</Th>
                  <Th>Status</Th>
                  <Th>Leads</Th>
                  <Th>Created</Th>
                  <Th />
                </Tr>
              </THead>
              <TBody>
                {filteredForms.length === 0 ? (
                  <Tr>
                    <Td colSpan={6}>
                      <EmptyState
                        icon={FileText}
                        title="No lead forms found"
                        description="Forms from your Lead Ads will appear here once created."
                      />
                    </Td>
                  </Tr>
                ) : (
                  filteredForms.map((f) => {
                    const isSynced = crmIsForSelectedPage && !!crmStatus?.syncedFormIds.includes(f.id);
                    const isSyncing = syncingId === f.id;
                    const isSelected = selectedForms.includes(f.id);

                    return (
                      <Tr key={f.id} selected={isSelected}>
                        <Td>
                          <Checkbox
                            checked={isSelected}
                            onChange={() => toggleSelectForm(f.id)}
                            aria-label={`Select form ${f.name}`}
                          />
                        </Td>
                        <Td className="font-medium">
                          <div className="flex flex-col gap-1">
                            <span className="truncate max-w-[200px] sm:max-w-[300px]">{f.name}</span>
                            <span className="text-[10px] text-[var(--st-text-secondary)] font-mono">{f.id}</span>
                            {isSynced && (
                              <Badge tone="success" className="text-[10px] w-fit mt-1">
                                <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden="true" /> CRM synced
                              </Badge>
                            )}
                          </div>
                        </Td>
                        <Td>
                          <Badge kind="outline">{f.status}</Badge>
                        </Td>
                        <Td className="tabular-nums font-medium">{f.leads_count || 0}</Td>
                        <Td className="text-xs text-[var(--st-text-secondary)] whitespace-nowrap">
                          {formatDate(f.created_time)}
                        </Td>
                        <Td>
                          <div className="flex flex-wrap items-center gap-1.5 justify-end">
                            <Button size="sm" variant="outline" iconLeft={Download} onClick={() => exportLeads(f.id)}>
                              Export
                            </Button>
                            {isSynced ? (
                              <LinkButton href={CRM_FB_INTEGRATION_HREF} icon={SettingsIcon}>
                                Configure
                              </LinkButton>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                iconLeft={RefreshCw}
                                loading={isSyncing}
                                onClick={() => syncToCrm(f)}
                                disabled={isSyncing || crmIsForDifferentPage}
                              >
                                Sync to CRM
                              </Button>
                            )}
                          </div>
                        </Td>
                      </Tr>
                    );
                  })
                )}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create lead form</DialogTitle>
            <DialogDescription>Lead forms are created through Meta Ads Manager. Use the link below to create one.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-[var(--st-text-secondary)]">To create a new lead generation form:</p>
            <ol className="text-sm space-y-2 list-decimal list-inside text-[var(--st-text-secondary)]">
              <li>Go to Meta Ads Manager</li>
              <li>Create a new campaign with Lead Generation objective</li>
              <li>Build your Instant Form in the ad creation step</li>
              <li>The form will appear here automatically</li>
            </ol>
            <a
              href="https://business.facebook.com/adsmanager"
              target="_blank"
              rel="noopener noreferrer"
              className="u-btn u-btn--primary u-btn--md u-btn--block"
            >
              <span className="u-btn__label">Open Meta Ads Manager</span>
            </a>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
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
    return <Skeleton height={48} width="100%" radius={8} />;
  }

  if (!status.configured) {
    return (
      <Alert tone="warning" icon={AlertTriangle}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span>
            CRM lead-sync is not configured yet. Click "Sync to CRM" on any form below, or configure mapping and routing first.
          </span>
          <LinkButton href={CRM_FB_INTEGRATION_HREF} icon={SettingsIcon}>
            Open CRM settings
          </LinkButton>
        </div>
      </Alert>
    );
  }

  if (forDifferentPage) {
    return (
      <Alert tone="warning" icon={AlertTriangle}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span>
            CRM is wired to a different Facebook Page (<code className="font-mono text-[12px]">{status.pageId}</code>). Forms on{' '}
            <strong>{selectedPageName || 'this page'}</strong> cannot sync until you switch pages in CRM settings.
          </span>
          <LinkButton href={CRM_FB_INTEGRATION_HREF} icon={SettingsIcon}>
            Switch in CRM
          </LinkButton>
        </div>
      </Alert>
    );
  }

  if (forSelectedPage && !status.isActive) {
    return (
      <Alert tone="warning" icon={AlertTriangle}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span>
            CRM is wired to this page but lead sync is <strong>inactive</strong>. Enable it in CRM settings to resume real-time sync.
          </span>
          <LinkButton href={CRM_FB_INTEGRATION_HREF} icon={SettingsIcon}>
            Activate
          </LinkButton>
        </div>
      </Alert>
    );
  }

  return (
    <Alert tone="success" icon={CheckCircle2}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <span>
          Connected to CRM, {status.syncedFormIds.length} form{status.syncedFormIds.length === 1 ? '' : 's'} syncing in real-time.
        </span>
        <LinkButton href={CRM_FB_INTEGRATION_HREF} icon={SettingsIcon}>
          Mapping and routing
        </LinkButton>
      </div>
    </Alert>
  );
}
