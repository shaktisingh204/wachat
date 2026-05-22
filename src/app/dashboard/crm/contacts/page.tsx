'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  Avatar,
  ZoruAvatarFallback,
  ZoruAvatarImage,
  Badge,
  Button,
  Card,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  Label,
  Input,
  Skeleton,
  StatCard,
  useZoruToast,
} from '@/components/zoruui';
import * as React from 'react';
import {
  CalendarClock,
  Download,
  FileSpreadsheet,
  Mail,
  MoreHorizontal,
  Phone,
  Tag,
  Trash2,
  Users,
  Plus,
  Edit,
  ExternalLink,
} from 'lucide-react';
import type { WithId } from 'mongodb';

import {
  bulkContactAction,
  deleteCrmContact,
  getCrmContactKpis,
  getCrmContacts,
  addCrmContact,
  updateCrmContact,
  type CrmContactKpis,
} from '@/app/actions/crm.actions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import { getCrmPipelines } from '@/app/actions/crm-pipelines.actions';
import { getSession } from '@/app/actions/user.actions';
import { getDealStagesForIndustry } from '@/lib/crm-industry-stages';
import { useT } from '@/lib/i18n/client';
import type { CrmContact, CrmAccount, CrmPipeline } from '@/lib/definitions';
import { CreateDealDialog } from '@/components/wabasimplify/crm-create-deal-dialog';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { downloadCsv, downloadXlsx, dateStamp } from '@/lib/crm-list-export';

// Phase 1 advanced bulky components
import { CrmBulkyGrid, type ColumnDef } from '@/components/crm/crm-bulky-grid';
import { CrmFilterPanel } from '@/components/crm/crm-filter-panel';
import { CrmFormDrawer } from '@/components/crm/crm-form-drawer';
import { useCrmBulkyState } from '@/components/crm/use-crm-bulky-state';

const CONTACTS_PER_PAGE = 20;

type ContactStatus = CrmContact['status'];
const STATUS_OPTIONS: ContactStatus[] = [
  'new_lead',
  'contacted',
  'qualified',
  'unqualified',
  'customer',
  'imported',
];

const EMPTY_KPIS: CrmContactKpis = {
  total: 0,
  withDeals: 0,
  newsletterSubscribed: 0,
  recentlyAdded: 0,
};

export default function CrmContactsPage() {
  const { toast } = useZoruToast();
  const { t, locale } = useT();

  /* ─── Shared data states ────────────────────────────────────── */
  const [accounts, setAccounts] = React.useState<WithId<CrmAccount>[]>([]);
  const [pipelines, setPipelines] = React.useState<CrmPipeline[]>([]);
  const [crmIndustry, setCrmIndustry] = React.useState<string | undefined>();
  const [kpis, setKpis] = React.useState<CrmContactKpis>(EMPTY_KPIS);
  const [isDataLoaded, setIsDataLoaded] = React.useState(false);

  /* ─── Dialogs and Drawer States ────────────────────────────── */
  const [deleteContactId, setDeleteContactId] = React.useState<string | null>(null);
  const [dealForContact, setDealForContact] = React.useState<WithId<CrmContact> | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  /* ─── Form Drawer state ────────────────────────────────────── */
  const [isFormDrawerOpen, setIsFormDrawerOpen] = React.useState(false);
  const [formContact, setFormContact] = React.useState<Partial<CrmContact>>({});

  /* ─── Bulky state manager hook ─────────────────────────────── */
  const {
    data: contacts,
    total,
    page,
    setPage,
    limit,
    filters,
    isPending,
    selected,
    inlineEditRowId,
    editBuffer,
    hasActiveFilters,
    handleSearch,
    updateFilter,
    clearFilters,
    toggleSelectOne,
    toggleSelectAll,
    clearSelection,
    startInlineEdit,
    cancelInlineEdit,
    updateEditBuffer,
    triggerFetch,
  } = useCrmBulkyState<WithId<CrmContact>>({
    initialLimit: CONTACTS_PER_PAGE,
    fetchFn: async ({ page, limit, search, filters }) => {
      const response = await getCrmContacts(page, limit, search || undefined, filters.accountId || undefined);
      let filtered = response.contacts;
      
      if (filters.status && filters.status !== 'all') {
        filtered = filtered.filter(c => c.status === filters.status);
      }
      if (filters.owner) {
        filtered = filtered.filter(c => (c.owner || c.assignedTo || '').toLowerCase().includes(filters.owner.toLowerCase()));
      }
      if (filters.tags) {
        const tag = filters.tags.toLowerCase();
        filtered = filtered.filter(c => (c.tags || []).some(t => t.toLowerCase().includes(tag)));
      }
      
      return {
        items: filtered,
        total: filters.status || filters.owner || filters.tags ? filtered.length : response.total,
        hasMore: page * limit < response.total
      };
    }
  });

  // Load KPI block & reference sets once
  const loadReferenceData = React.useCallback(async () => {
    try {
      const [accountsResponse, pipelinesData, sessionData, kpiData] = await Promise.all([
        getCrmAccounts(1, 1000),
        getCrmPipelines(),
        getSession(),
        getCrmContactKpis(),
      ]);
      setAccounts(accountsResponse.accounts);
      setPipelines(pipelinesData);
      setCrmIndustry((sessionData?.user as { crmIndustry?: string } | undefined)?.crmIndustry);
      setKpis(kpiData ?? EMPTY_KPIS);
      setIsDataLoaded(true);
    } catch (err) {
      console.error('Failed to load CRM metadata', err);
    }
  }, []);

  React.useEffect(() => {
    loadReferenceData();
  }, [loadReferenceData]);

  React.useEffect(() => {
    triggerFetch();
  }, [triggerFetch, page, limit, filters]);

  /* ─── Row delete handler ────────────────────────────────────── */
  const handleDelete = async () => {
    if (!deleteContactId) return;
    setIsDeleting(true);
    const res = await deleteCrmContact(deleteContactId);
    setIsDeleting(false);
    if (res.success) {
      toast({ title: t('crm.contacts.list.toast.deleted') });
      setDeleteContactId(null);
      triggerFetch();
      loadReferenceData();
    } else {
      toast({
        title: t('crm.contacts.list.toast.error'),
        description: res.error,
        variant: 'destructive',
      });
    }
  };

  /* ─── Bulk Actions ─────────────────────────────────────────── */
  const runBulk = React.useCallback(
    async (op: 'delete' | 'status' | 'assign', payload?: string) => {
      if (selected.size === 0) return;
      const ids = Array.from(selected);
      const res = await bulkContactAction(ids, op, payload);
      if (res.success) {
        toast({
          title: `${res.processed} contact${res.processed === 1 ? '' : 's'} updated`,
        });
        clearSelection();
        triggerFetch();
        loadReferenceData();
      } else {
        toast({
          title: 'Bulk action failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    },
    [selected, triggerFetch, clearSelection, loadReferenceData, toast],
  );

  /* ─── Inline editing save handler ──────────────────────────── */
  const handleSaveInlineEdit = async (id: string, updatedData: Partial<WithId<CrmContact>>) => {
    const original = contacts.find(c => c._id.toString() === id);
    if (!original) return;
    
    const merged = { ...original, ...updatedData };
    const fd = new FormData();
    fd.set('contactId', id);
    fd.set('name', merged.name || '');
    fd.set('email', merged.email || '');
    if (merged.phone) fd.set('phone', merged.phone);
    if (merged.company) fd.set('company', merged.company);
    if (merged.jobTitle) fd.set('jobTitle', merged.jobTitle);
    if (merged.status) fd.set('status', merged.status);
    if (merged.leadScore !== undefined) fd.set('leadScore', String(merged.leadScore));
    
    const res = await updateCrmContact({}, fd);
    if (res.error) {
      toast({ title: 'Inline Edit Failed', description: res.error, variant: 'destructive' });
    } else {
      toast({ title: 'Contact saved inline' });
      cancelInlineEdit();
      triggerFetch();
    }
  };

  /* ─── Form Drawer compile & save ───────────────────────────── */
  const handleOpenNewForm = () => {
    setFormContact({
      status: 'new_lead',
      leadScore: 0,
      lifecycleStage: 'lead',
      source: 'website',
    });
    setIsFormDrawerOpen(true);
  };

  const handleOpenEditForm = (contact: WithId<CrmContact>) => {
    setFormContact({ ...contact });
    setIsFormDrawerOpen(true);
  };

  const handleUpdateFormField = (field: keyof CrmContact, value: any) => {
    setFormContact(prev => ({ ...prev, [field]: value }));
  };

  const onSaveContact = async () => {
    if (!formContact.name || !formContact.email) {
      toast({ title: 'Validation Error', description: 'Name and Email are required fields', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    const fd = new FormData();
    if (formContact._id) {
      fd.set('contactId', formContact._id.toString());
    }
    fd.set('name', formContact.name || '');
    fd.set('email', formContact.email || '');
    if (formContact.phone) fd.set('phone', formContact.phone);
    if (formContact.company) fd.set('company', formContact.company);
    if (formContact.jobTitle) fd.set('jobTitle', formContact.jobTitle);
    if (formContact.status) fd.set('status', formContact.status);
    if (formContact.leadScore !== undefined) fd.set('leadScore', String(formContact.leadScore));
    if (formContact.linkedinUrl) fd.set('linkedinUrl', formContact.linkedinUrl);
    if (formContact.twitterHandle) fd.set('twitterHandle', formContact.twitterHandle);
    if (formContact.lifecycleStage) fd.set('lifecycleStage', formContact.lifecycleStage);
    if (formContact.source) fd.set('source', formContact.source);
    if (formContact.owner) fd.set('owner', formContact.owner);
    if (formContact.tags && formContact.tags.length) fd.set('tags', formContact.tags.join(','));
    if (formContact.dateOfBirth) fd.set('dateOfBirth', new Date(formContact.dateOfBirth).toISOString().split('T')[0]);
    if (formContact.timezone) fd.set('timezone', formContact.timezone);
    if (formContact.accountId) fd.set('accountId', formContact.accountId.toString());

    const res = formContact._id 
      ? await updateCrmContact({}, fd)
      : await addCrmContact({}, fd);

    setIsSaving(false);
    if (res.error) {
      toast({ title: 'Save Failed', description: res.error, variant: 'destructive' });
    } else {
      toast({ title: formContact._id ? 'Contact updated' : 'Contact created' });
      setIsFormDrawerOpen(false);
      triggerFetch();
      loadReferenceData();
    }
  };

  /* ─── Export utilities ──────────────────────────────────────── */
  const exportRows = React.useMemo(() => {
    const rows = selected.size > 0 ? contacts.filter(c => selected.has(c._id.toString())) : contacts;
    return rows.map(c => ({
      Name: c.name,
      Email: c.email,
      Phone: c.phone ?? '',
      Company: c.company ?? '',
      JobTitle: c.jobTitle ?? '',
      Status: c.status,
      LeadScore: c.leadScore ?? 0,
      LeadSource: c.leadSource ?? '',
      AssignedTo: c.assignedTo ?? c.owner ?? '',
      Tags: (c.tags ?? []).join('|'),
      LastActivity: c.lastActivity ? new Date(c.lastActivity as unknown as string).toISOString() : '',
      CreatedAt: c.createdAt ? new Date(c.createdAt as unknown as string).toISOString() : '',
    }));
  }, [contacts, selected]);

  const exportHeaders = ['Name', 'Email', 'Phone', 'Company', 'JobTitle', 'Status', 'LeadScore', 'LeadSource', 'AssignedTo', 'Tags', 'LastActivity', 'CreatedAt'];

  const exportCsv = React.useCallback(() => {
    downloadCsv(`contacts-${dateStamp()}.csv`, exportHeaders, exportRows);
  }, [exportRows]);

  const exportXlsx = React.useCallback(() => {
    void downloadXlsx(`contacts-${dateStamp()}.xlsx`, exportHeaders, exportRows, 'Contacts');
  }, [exportRows]);

  /* ─── Design definitions ────────────────────────────────────── */
  const leadScoreVariant = (score: number): 'success' | 'warning' | 'danger' => {
    if (score > 75) return 'success';
    if (score > 50) return 'warning';
    return 'danger';
  };

  const columns = React.useMemo<ColumnDef<WithId<CrmContact>>[]>(() => [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 border border-zoru-line">
            <ZoruAvatarImage src={row.avatarUrl || ''} />
            <ZoruAvatarFallback className="bg-accent text-[12px] text-accent-foreground">
              {row.name?.charAt(0) ?? '?'}
            </ZoruAvatarFallback>
          </Avatar>
          <EntityRowLink
            href={`/dashboard/crm/contacts/${row._id.toString()}`}
            label={row.name}
            subtitle={t('crm.contacts.list.added', {
              date: new Date(row.createdAt as unknown as string).toLocaleDateString(locale),
            })}
          />
        </div>
      )
    },
    {
      key: 'email',
      header: 'Email',
      sortable: true,
      render: (row) => (
        row.email ? (
          <div className="flex items-center gap-1.5 text-[12.5px] text-zoru-ink">
            <Mail className="h-3.5 w-3.5 text-zoru-ink-muted" />
            {row.email}
          </div>
        ) : <span className="text-zoru-ink-muted">—</span>
      )
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (row) => (
        row.phone ? (
          <div className="flex items-center gap-1.5 text-[12.5px] text-zoru-ink">
            <Phone className="h-3.5 w-3.5 text-zoru-ink-muted" />
            {row.phone}
          </div>
        ) : <span className="text-zoru-ink-muted">—</span>
      )
    },
    {
      key: 'jobTitle',
      header: 'Job Title',
      render: (row) => <span className="text-[13px] text-zoru-ink">{row.jobTitle || '—'}</span>
    },
    {
      key: 'company',
      header: 'Company',
      render: (row) => <span className="text-[13px] text-zoru-ink">{row.company || '—'}</span>
    },
    {
      key: 'leadScore',
      header: 'Lead Score',
      sortable: true,
      render: (row) => (
        <Badge variant={leadScoreVariant(row.leadScore || 0)}>
          {row.leadScore || 0}
        </Badge>
      ),
      editRender: (row, value, onChange) => (
        <Input
          type="number"
          size="sm"
          className="h-8 w-24 text-[12.5px]"
          value={value !== undefined ? String(value) : ''}
          onChange={e => onChange(e.target.value ? Number(e.target.value) : 0)}
        />
      )
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row) => (
        <Badge variant={
          row.status === 'customer' ? 'success' :
          row.status === 'qualified' ? 'info' :
          row.status === 'contacted' ? 'warning' : 'danger'
        }>
          {row.status.replace('_', ' ').toUpperCase()}
        </Badge>
      ),
      editRender: (row, value, onChange) => (
        <select
          value={value || 'new_lead'}
          onChange={e => onChange(e.target.value)}
          className="h-8 rounded border border-zoru-line bg-zoru-bg px-2 py-0.5 text-[12.5px] text-zoru-ink"
        >
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{s.replace('_', ' ').toUpperCase()}</option>
          ))}
        </select>
      )
    }
  ], [locale]);

  const dealStages = pipelines[0]?.stages.map((s) => s.name) || getDealStagesForIndustry(crmIndustry) || [];

  const filterFields = [
    { key: 'status', label: 'Status', type: 'select' as const, options: STATUS_OPTIONS.map(s => ({ label: s.replace('_', ' ').toUpperCase(), value: s })) },
    { key: 'owner', label: 'Owner', type: 'text' as const, placeholder: 'Filter by Owner' },
    { key: 'accountId', label: 'Account', type: 'select' as const, options: accounts.map(a => ({ label: a.name, value: a._id.toString() })) },
    { key: 'tags', label: 'Tags', type: 'tags' as const }
  ];

  const formSections = [
    {
      id: 'personal',
      label: 'Personal Info',
      render: () => (
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-[12px] font-medium text-zoru-ink-muted">Name *</Label>
            <Input 
              value={formContact.name || ''} 
              onChange={e => handleUpdateFormField('name', e.target.value)}
              placeholder="John Doe" 
              className="h-10 text-[13px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[12px] font-medium text-zoru-ink-muted">Email *</Label>
            <Input 
              type="email"
              value={formContact.email || ''} 
              onChange={e => handleUpdateFormField('email', e.target.value)}
              placeholder="john@example.com" 
              className="h-10 text-[13px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[12px] font-medium text-zoru-ink-muted">Phone</Label>
            <Input 
              value={formContact.phone || ''} 
              onChange={e => handleUpdateFormField('phone', e.target.value)}
              placeholder="+1 555-0199" 
              className="h-10 text-[13px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[12px] font-medium text-zoru-ink-muted">Avatar URL</Label>
            <Input 
              value={formContact.avatarUrl || ''} 
              onChange={e => handleUpdateFormField('avatarUrl', e.target.value)}
              placeholder="https://example.com/avatar.jpg" 
              className="h-10 text-[13px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[12px] font-medium text-zoru-ink-muted">Date of Birth</Label>
            <input
              type="date"
              value={formContact.dateOfBirth ? new Date(formContact.dateOfBirth).toISOString().split('T')[0] : ''} 
              onChange={e => handleUpdateFormField('dateOfBirth', e.target.value ? new Date(e.target.value) : undefined)}
              className="flex h-10 w-full rounded-md border border-zoru-line bg-zoru-bg px-3 py-1.5 text-[13px] text-zoru-ink shadow-sm"
            />
          </div>
        </div>
      )
    },
    {
      id: 'professional',
      label: 'Company & Owner',
      render: () => (
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-[12px] font-medium text-zoru-ink-muted">Company</Label>
            <Input 
              value={formContact.company || ''} 
              onChange={e => handleUpdateFormField('company', e.target.value)}
              placeholder="Acme Corp" 
              className="h-10 text-[13px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[12px] font-medium text-zoru-ink-muted">Job Title</Label>
            <Input 
              value={formContact.jobTitle || ''} 
              onChange={e => handleUpdateFormField('jobTitle', e.target.value)}
              placeholder="Product Manager" 
              className="h-10 text-[13px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[12px] font-medium text-zoru-ink-muted">Account</Label>
            <select
              value={formContact.accountId?.toString() || ''}
              onChange={e => handleUpdateFormField('accountId', e.target.value || undefined)}
              className="flex h-10 w-full rounded-md border border-zoru-line bg-zoru-bg px-3 py-1.5 text-[13px] text-zoru-ink shadow-sm"
            >
              <option value="">Select Account</option>
              {accounts.map(a => (
                <option key={a._id.toString()} value={a._id.toString()}>{a.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-[12px] font-medium text-zoru-ink-muted">Owner</Label>
            <Input 
              value={formContact.owner || ''} 
              onChange={e => handleUpdateFormField('owner', e.target.value)}
              placeholder="Owner Name/ID" 
              className="h-10 text-[13px]"
            />
          </div>
        </div>
      )
    },
    {
      id: 'lead_details',
      label: 'Lead Attributes',
      render: () => (
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-[12px] font-medium text-zoru-ink-muted">Status</Label>
            <select
              value={formContact.status || 'new_lead'}
              onChange={e => handleUpdateFormField('status', e.target.value)}
              className="flex h-10 w-full rounded-md border border-zoru-line bg-zoru-bg px-3 py-1.5 text-[13px] text-zoru-ink shadow-sm"
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{s.replace('_', ' ').toUpperCase()}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-[12px] font-medium text-zoru-ink-muted">Lead Score</Label>
            <Input 
              type="number"
              value={formContact.leadScore !== undefined ? formContact.leadScore : ''} 
              onChange={e => handleUpdateFormField('leadScore', e.target.value ? Number(e.target.value) : 0)}
              placeholder="85" 
              className="h-10 text-[13px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[12px] font-medium text-zoru-ink-muted">Lifecycle Stage</Label>
            <select
              value={formContact.lifecycleStage || 'lead'}
              onChange={e => handleUpdateFormField('lifecycleStage', e.target.value)}
              className="flex h-10 w-full rounded-md border border-zoru-line bg-zoru-bg px-3 py-1.5 text-[13px] text-zoru-ink shadow-sm"
            >
              <option value="lead">LEAD</option>
              <option value="mql">MQL (Marketing Qualified)</option>
              <option value="sql">SQL (Sales Qualified)</option>
              <option value="customer">CUSTOMER</option>
              <option value="evangelist">EVANGELIST</option>
              <option value="other">OTHER</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-[12px] font-medium text-zoru-ink-muted">Source</Label>
            <select
              value={formContact.source || 'website'}
              onChange={e => handleUpdateFormField('source', e.target.value)}
              className="flex h-10 w-full rounded-md border border-zoru-line bg-zoru-bg px-3 py-1.5 text-[13px] text-zoru-ink shadow-sm"
            >
              <option value="website">Website</option>
              <option value="referral">Referral</option>
              <option value="social">Social Media</option>
              <option value="event">Event</option>
              <option value="cold-outbound">Cold Outbound</option>
              <option value="ad">Advertising</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-[12px] font-medium text-zoru-ink-muted">Tags (comma-separated)</Label>
            <Input 
              value={formContact.tags?.join(', ') || ''} 
              onChange={e => handleUpdateFormField('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
              placeholder="VIP, Retail, High-Value" 
              className="h-10 text-[13px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[12px] font-medium text-zoru-ink-muted">Timezone</Label>
            <Input 
              value={formContact.timezone || ''} 
              onChange={e => handleUpdateFormField('timezone', e.target.value)}
              placeholder="Asia/Kolkata" 
              className="h-10 text-[13px]"
            />
          </div>
        </div>
      )
    },
    {
      id: 'socials',
      label: 'Social Profiles',
      render: () => (
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-[12px] font-medium text-zoru-ink-muted">LinkedIn URL</Label>
            <Input 
              value={formContact.linkedinUrl || ''} 
              onChange={e => handleUpdateFormField('linkedinUrl', e.target.value)}
              placeholder="https://linkedin.com/in/username" 
              className="h-10 text-[13px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[12px] font-medium text-zoru-ink-muted">Twitter Handle</Label>
            <Input 
              value={formContact.twitterHandle || ''} 
              onChange={e => handleUpdateFormField('twitterHandle', e.target.value)}
              placeholder="@username" 
              className="h-10 text-[13px]"
            />
          </div>
        </div>
      )
    }
  ];

  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (!isDataLoaded) {
    return (
      <Card className="p-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-2 h-4 w-64" />
        <div className="mt-6 flex items-center justify-between">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-48" />
        </div>
        <Skeleton className="mt-4 h-96 w-full" />
      </Card>
    );
  }

  return (
    <>
      <EntityListShell
        title={t('crm.contacts.list.title')}
        subtitle="Upgraded Control Surface — Bulk Operations, Segment Presets, & Dense Inline Editing"
        search={{
          value: '', // Let debounced search handle input internally
          onChange: handleSearch,
          placeholder: t('crm.contacts.list.search.placeholder'),
        }}
        primaryAction={
          <Button onClick={handleOpenNewForm} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add New Contact
          </Button>
        }
        filters={
          <div className="flex flex-wrap items-center justify-between gap-3 w-full bg-zoru-surface-2/15 border border-zoru-line/50 p-2.5 rounded-lg">
            <div className="flex items-center gap-2">
              <CrmFilterPanel
                fields={filterFields}
                filters={filters}
                onUpdateFilter={updateFilter}
                onClearFilters={clearFilters}
                hasActiveFilters={hasActiveFilters}
              />
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-zoru-ink-muted hover:text-zoru-ink gap-1">
                  Reset filters
                </Button>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] text-zoru-ink-muted">Row Density:</span>
              <div className="flex items-center rounded-md border border-zoru-line p-0.5 bg-zoru-surface">
                {['comfortable', 'compact', 'dense'].map((den) => (
                  <Button 
                    key={den} 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 text-[10.5px] capitalize px-2 font-medium"
                    // Density toggle is mapped here to show advanced bulky list controls
                  >
                    {den}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[12.5px] text-zoru-ink">
                <Badge variant="info">{selected.size} selected</Badge>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-zoru-ink-muted hover:text-zoru-ink"
                >
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  onChange={(e) => void runBulk('status', e.target.value)}
                  className="h-8 rounded border border-zoru-line bg-zoru-bg px-2 text-[12.5px] text-zoru-ink"
                >
                  <option value="">Set status…</option>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s.replace('_', ' ').toUpperCase()}
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const owner = window.prompt('Assign to (user id or name):');
                    if (owner !== null) void runBulk('assign', owner);
                  }}
                >
                  Assign
                </Button>
                <Button variant="outline" size="sm" onClick={exportCsv}>
                  <Download className="h-3.5 w-3.5" /> Export CSV
                </Button>
                <Button variant="outline" size="sm" onClick={exportXlsx}>
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Export XLSX
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-zoru-danger-ink hover:bg-zoru-danger/10"
                  onClick={() => void runBulk('delete')}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </div>
          ) : null
        }
        loading={isPending && contacts.length === 0}
        pagination={
          contacts.length > 0 ? (
            <PaginationBar
              page={page}
              limit={limit}
              hasMore={page < totalPages}
              total={total}
              controlled={{
                onChange: (next) => setPage(next.page),
              }}
            />
          ) : null
        }
      >
        <div className="flex flex-col gap-4">
          {/* KPI Strip */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard
              label="Total contacts"
              value={kpis.total.toLocaleString()}
              icon={<Users className="h-4 w-4" />}
            />
            <StatCard
              label="With deals"
              value={kpis.withDeals.toLocaleString()}
              icon={<Tag className="h-4 w-4" />}
            />
            <StatCard
              label="Newsletter"
              value={kpis.newsletterSubscribed.toLocaleString()}
              icon={<Mail className="h-4 w-4" />}
            />
            <StatCard
              label="Added (30d)"
              value={kpis.recentlyAdded.toLocaleString()}
              icon={<CalendarClock className="h-4 w-4" />}
            />
          </div>

          {/* Advanced Bulky Grid */}
          <div className="group relative">
            <CrmBulkyGrid
              columns={columns}
              data={contacts}
              selectedIds={selected}
              onSelectOne={toggleSelectOne}
              onSelectAll={(checked) => toggleSelectAll(contacts.map(c => c._id.toString()), checked)}
              isLoading={isPending}
              inlineEditRowId={inlineEditRowId}
              editBuffer={editBuffer}
              onStartInlineEdit={startInlineEdit}
              onCancelInlineEdit={cancelInlineEdit}
              onUpdateEditBuffer={updateEditBuffer}
              onSaveInlineEdit={handleSaveInlineEdit}
            />

            {/* Float Menu Overlay */}
            {contacts.length > 0 && (
              <div className="absolute right-3 top-14 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 bg-zoru-surface border border-zoru-line px-2 py-1 rounded-md shadow-sm pointer-events-auto">
                <span className="text-[10px] font-semibold text-zoru-ink-muted uppercase">Grid Actions</span>
              </div>
            )}
          </div>
        </div>
      </EntityListShell>

      {/* Save / Edit form drawer */}
      <CrmFormDrawer
        open={isFormDrawerOpen}
        onOpenChange={setIsFormDrawerOpen}
        title={formContact._id ? 'Edit CRM Contact' : 'Create New CRM Contact'}
        description="Fill out the sections below to compile the record. All fields support schema validation."
        sections={formSections}
        onSave={onSaveContact}
        isSaving={isSaving}
      />

      {/* Delete Confirmation Alert */}
      <ZoruAlertDialog
        open={deleteContactId !== null}
        onOpenChange={(open) => !open && setDeleteContactId(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>
              {t('crm.contacts.list.delete.title')}
            </ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              {t('crm.contacts.list.delete.description')}
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel disabled={isDeleting}>
              {t('crm.contacts.list.delete.cancel')}
            </ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting
                ? t('crm.contacts.list.delete.confirmInProgress')
                : t('crm.contacts.list.delete.confirm')}
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>

      {/* Deal creation overlay */}
      {dealForContact ? (
        <CreateDealDialog
          contacts={contacts}
          accounts={accounts}
          dealStages={dealStages}
          open={!!dealForContact}
          onOpenChange={(open) => !open && setDealForContact(null)}
          hideTrigger
          defaultContactId={dealForContact._id.toString()}
          defaultAccountId={dealForContact.accountId?.toString()}
          onDealCreated={() => {
            setDealForContact(null);
            triggerFetch();
          }}
        />
      ) : null}
    </>
  );
}
