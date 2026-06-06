'use client';

import {
  Badge,
  Button,
  IconButton,
  Card,
  Field,
  Input,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SegmentedControl,
  Slider,
  Progress,
  Spinner,
  Skeleton,
  EmptyState,
  PageHeader,
  PageHeading,
  PageTitle,
  PageActions,
} from '@/components/sabcrm/20ui';
import {
  Users,
  Plus,
  Trash2,
  Copy,
  Search,
  Target,
  RefreshCw,
  Globe,
} from 'lucide-react';

import * as React from 'react';
import Link from 'next/link';

import { useToast } from '@/hooks/use-toast';
import { useAdManager } from '@/context/ad-manager-context';
import {
  getCustomAudiences,
  createCustomAudience,
  createLookalikeAudience,
  deleteCustomAudience,
} from '@/app/actions/ad-manager.actions';
import { COUNTRIES, formatNumber } from '@/components/zoruui-domain/ad-manager/constants';
import { AmBreadcrumb } from '@/app/dashboard/ad-manager/_components/am-page-shell';
import type { CustomAudience } from '@/lib/definitions';

/* ------------------------------------------------------------------ */
/*  Skeleton rows                                                      */
/* ------------------------------------------------------------------ */
function AudienceRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <Skeleton circle width={36} />
      <div className="flex-1 space-y-2">
        <Skeleton width={160} height={14} radius={4} />
        <Skeleton width={96} height={10} radius={4} />
      </div>
      <Skeleton width={64} height={24} radius={999} />
      <Skeleton width={56} height={12} radius={4} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  No-account state                                                   */
/* ------------------------------------------------------------------ */
function NoAccountState() {
  return (
    <div className="py-24">
      <EmptyState
        icon={Users}
        title="No ad account selected"
        description="Pick an ad account to view and manage your audiences."
        action={
          <Link href="/dashboard/ad-manager/ad-accounts">
            <Button variant="primary">Go to Ad Accounts</Button>
          </Link>
        }
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Audience row                                                       */
/* ------------------------------------------------------------------ */
function AudienceRow({
  audience,
  onDelete,
}: {
  audience: CustomAudience & { subtype?: string };
  onDelete: (id: string) => void;
}) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const subtype = audience.subtype || 'CUSTOM';

  const badgeTone = (() => {
    switch (subtype) {
      case 'LOOKALIKE':
        return 'warning' as const;
      case 'WEBSITE':
        return 'info' as const;
      case 'ENGAGEMENT':
        return 'success' as const;
      default:
        return 'neutral' as const;
    }
  })();

  const isPopulating =
    audience.operation_status?.code === 400 || audience.delivery_status?.code === 400;

  return (
    <>
      <div className="group flex items-center gap-4 px-5 py-3.5 border-b border-[var(--st-border)] last:border-b-0 hover:bg-[var(--st-bg-muted)] transition-colors">
        {/* icon */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--st-bg-muted)]">
          {subtype === 'LOOKALIKE' ? (
            <Copy className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
          ) : subtype === 'WEBSITE' ? (
            <Globe className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
          ) : (
            <Target className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
          )}
        </div>

        {/* name + description */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-[var(--st-text)] truncate">{audience.name}</p>
          {audience.description && (
            <p className="text-[11px] text-[var(--st-text-secondary)] truncate mt-0.5">
              {audience.description}
            </p>
          )}
          {isPopulating && (
            <div className="mt-2.5 flex items-center gap-2 max-w-[200px]">
              <Progress value={65} tone="warning" size="sm" className="flex-1" />
              <span className="text-[10px] text-[var(--st-text-secondary)] font-medium">
                Populating...
              </span>
            </div>
          )}
        </div>

        {/* badge */}
        <div className="flex items-center gap-2">
          <Badge tone={badgeTone}>{subtype}</Badge>
          {isPopulating && (
            <Badge tone="warning">
              <Spinner size={12} label="Populating" className="mr-1 inline-block align-middle" />
              Populating
            </Badge>
          )}
        </div>

        {/* approximate count */}
        <span className="text-[13px] text-[var(--st-text)] tabular-nums min-w-[72px] text-right">
          {audience.approximate_count_lower_bound === -1
            ? 'Under 1000'
            : audience.approximate_count_lower_bound
              ? formatNumber(audience.approximate_count_lower_bound)
              : '--'}
        </span>

        {/* delete */}
        <IconButton
          label={`Delete ${audience.name}`}
          icon={Trash2}
          variant="ghost"
          className="opacity-0 group-hover:opacity-100"
          onClick={() => setConfirmOpen(true)}
        />
      </div>

      {/* delete confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete audience</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{audience.name}</strong>? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                onDelete(audience.id);
                setConfirmOpen(false);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Create audience sheet                                              */
/* ------------------------------------------------------------------ */
function CreateAudienceSheet({
  open,
  onOpenChange,
  onCreated,
  audiences,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
  audiences: CustomAudience[];
}) {
  const { toast } = useToast();
  const { activeAccount } = useAdManager();

  const [type, setType] = React.useState<'custom' | 'lookalike'>('custom');
  const [submitting, setSubmitting] = React.useState(false);

  // Custom fields
  const [customName, setCustomName] = React.useState('');
  const [customDesc, setCustomDesc] = React.useState('');
  const [customSubtype, setCustomSubtype] = React.useState<'WEBSITE' | 'ENGAGEMENT' | 'CUSTOM'>(
    'WEBSITE',
  );

  // Lookalike fields
  const [lookOrigin, setLookOrigin] = React.useState('');
  const [lookCountry, setLookCountry] = React.useState('IN');
  const [lookRatio, setLookRatio] = React.useState(1);

  const reset = () => {
    setCustomName('');
    setCustomDesc('');
    setCustomSubtype('WEBSITE');
    setLookOrigin('');
    setLookCountry('IN');
    setLookRatio(1);
  };

  const submit = async () => {
    if (!activeAccount) return;
    setSubmitting(true);

    let res;
    if (type === 'custom') {
      res = await createCustomAudience(activeAccount.account_id, {
        name: customName,
        description: customDesc,
        subtype: customSubtype,
      });
    } else {
      res = await createLookalikeAudience(activeAccount.account_id, {
        name: `Lookalike ${lookRatio}%`,
        origin_audience_id: lookOrigin,
        country: lookCountry,
        ratio: lookRatio / 100,
      });
    }

    setSubmitting(false);

    if (res.error) {
      toast({ title: 'Create failed', description: res.error, variant: 'destructive' });
      return;
    }

    toast({ title: 'Audience created' });
    reset();
    onOpenChange(false);
    onCreated();
  };

  const canSubmit =
    type === 'custom' ? customName.trim().length > 0 : lookOrigin.length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>Create audience</SheetTitle>
          <SheetDescription>Build a custom or lookalike audience for targeting.</SheetDescription>
        </SheetHeader>

        {/* type segmented control */}
        <div className="mb-6">
          <SegmentedControl
            aria-label="Audience type"
            value={type}
            onChange={(v) => setType(v as 'custom' | 'lookalike')}
            items={[
              { value: 'custom', label: 'Custom Audience' },
              { value: 'lookalike', label: 'Lookalike Audience' },
            ]}
            fullWidth
          />
        </div>

        {type === 'custom' ? (
          <div className="space-y-4">
            <Field label="Name">
              <Input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g. Website visitors, last 30 days"
              />
            </Field>

            <Field label="Description">
              <Input
                value={customDesc}
                onChange={(e) => setCustomDesc(e.target.value)}
                placeholder="Optional description"
              />
            </Field>

            <Field label="Source type">
              <Select
                value={customSubtype}
                onValueChange={(v) => setCustomSubtype(v as typeof customSubtype)}
              >
                <SelectTrigger aria-label="Source type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WEBSITE">Website (Pixel)</SelectItem>
                  <SelectItem value="ENGAGEMENT">Engagement</SelectItem>
                  <SelectItem value="CUSTOM">Customer list</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="Source audience">
              <Select value={lookOrigin} onValueChange={setLookOrigin}>
                <SelectTrigger aria-label="Source audience">
                  <SelectValue placeholder="Select a source audience" />
                </SelectTrigger>
                <SelectContent>
                  {audiences.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Country">
              <Select value={lookCountry} onValueChange={setLookCountry}>
                <SelectTrigger aria-label="Country">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label={
                <span className="flex items-center justify-between">
                  <span>Similarity ratio</span>
                  <span className="text-[13px] font-semibold text-[var(--st-text)] tabular-nums">
                    {lookRatio}%
                  </span>
                </span>
              }
            >
              <Slider
                ariaLabel="Similarity ratio"
                value={lookRatio}
                onValueChange={(v) => setLookRatio(Array.isArray(v) ? v[0] : v)}
                min={1}
                max={10}
                step={1}
              />
              <div className="flex justify-between text-[10px] text-[var(--st-text-secondary)] mt-1.5">
                <span>1% most similar</span>
                <span>10% broadest</span>
              </div>
            </Field>
          </div>
        )}

        {/* actions */}
        <div className="flex gap-3 mt-8 pt-5 border-t border-[var(--st-border)]">
          <Button variant="outline" block onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            block
            onClick={submit}
            loading={submitting}
            disabled={!canSubmit}
          >
            {submitting ? 'Creating...' : 'Create audience'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/*  Sync CRM Dialog                                                    */
/* ------------------------------------------------------------------ */
function SyncCrmDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const { activeAccount } = useAdManager();
  const [submitting, setSubmitting] = React.useState(false);

  const [segment, setSegment] = React.useState('all');
  const [audienceName, setAudienceName] = React.useState('CRM - All Customers');

  const submit = async () => {
    if (!activeAccount) return;
    setSubmitting(true);
    const res = await createCustomAudience(activeAccount.account_id, {
      name: audienceName,
      description: `Synced from CRM segment: ${segment}`,
      subtype: 'CUSTOM',
    });
    setSubmitting(false);

    if (res.error) {
      toast({ title: 'Sync failed', description: res.error, variant: 'destructive' });
      return;
    }

    toast({ title: 'CRM Data Synced', description: 'Audience created successfully.' });
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Sync CRM Data</DialogTitle>
          <DialogDescription>
            Import your Wachat CRM contacts to create a custom audience on Meta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Field label="Audience name">
            <Input
              value={audienceName}
              onChange={(e) => setAudienceName(e.target.value)}
              placeholder="e.g. High Value Customers"
            />
          </Field>

          <Field label="CRM segment">
            <Select value={segment} onValueChange={setSegment}>
              <SelectTrigger aria-label="CRM segment">
                <SelectValue placeholder="Select segment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Contacts</SelectItem>
                <SelectItem value="active">Active Subscribers</SelectItem>
                <SelectItem value="inactive">Inactive / Churned</SelectItem>
                <SelectItem value="high_value">High Value (LTV &gt; $500)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            loading={submitting}
            disabled={!audienceName.trim()}
          >
            {submitting ? 'Syncing...' : 'Sync & Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ================================================================== */
/*  Main page                                                          */
/* ================================================================== */
export default function AudiencesPage() {
  const { toast } = useToast();
  const { activeAccount } = useAdManager();

  const [loading, setLoading] = React.useState(true);
  const [audiences, setAudiences] = React.useState<(CustomAudience & { subtype?: string })[]>([]);
  const [search, setSearch] = React.useState('');
  const [tab, setTab] = React.useState<'custom' | 'lookalike'>('custom');
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [syncOpen, setSyncOpen] = React.useState(false);

  /* ---- load ---- */
  const load = React.useCallback(async () => {
    if (!activeAccount) return;
    setLoading(true);
    const res = await getCustomAudiences(activeAccount.account_id);
    if (res.error) {
      toast({ title: 'Failed to load audiences', description: res.error, variant: 'destructive' });
    }
    setAudiences(res.audiences || []);
    setLoading(false);
  }, [activeAccount, toast]);

  React.useEffect(() => {
    load();
  }, [load]);

  /* ---- delete ---- */
  const handleDelete = async (id: string) => {
    const res = await deleteCustomAudience(id);
    if (res.error) {
      toast({ title: 'Delete failed', description: res.error, variant: 'destructive' });
    } else {
      toast({ title: 'Audience deleted' });
      setAudiences((prev) => prev.filter((a) => a.id !== id));
    }
  };

  /* ---- derived ---- */
  const customAudiences = audiences.filter((a) => (a.subtype || 'CUSTOM') !== 'LOOKALIKE');
  const lookalikeAudiences = audiences.filter((a) => a.subtype === 'LOOKALIKE');

  const displayed = tab === 'custom' ? customAudiences : lookalikeAudiences;
  const filtered = displayed.filter(
    (a) => !search || a.name.toLowerCase().includes(search.toLowerCase()),
  );

  /* ---- no account ---- */
  if (!activeAccount) {
    return <NoAccountState />;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* breadcrumbs */}
      <AmBreadcrumb page="Audiences" />

      {/* header */}
      <PageHeader>
        <PageHeading>
          <PageTitle>
            <span className="flex items-center gap-3">
              Audiences
              <Badge tone="neutral">
                <span className="tabular-nums">{audiences.length}</span>
              </Badge>
            </span>
          </PageTitle>
        </PageHeading>
        <PageActions>
          <Button variant="outline" iconLeft={RefreshCw} onClick={() => setSyncOpen(true)}>
            Sync CRM
          </Button>
          <Button variant="primary" iconLeft={Plus} onClick={() => setSheetOpen(true)}>
            Create audience
          </Button>
        </PageActions>
      </PageHeader>

      {/* tab segmented control + search */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <SegmentedControl
          aria-label="Audience category"
          value={tab}
          onChange={(v) => setTab(v as 'custom' | 'lookalike')}
          items={[
            { value: 'custom', label: `Custom Audiences ${customAudiences.length}` },
            { value: 'lookalike', label: `Lookalike Audiences ${lookalikeAudiences.length}` },
          ]}
        />

        <Input
          iconLeft={Search}
          placeholder="Search audiences..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-[240px]"
          aria-label="Search audiences"
        />
      </div>

      {/* audience list */}
      <Card padding="none" className="overflow-hidden">
        {/* column header */}
        <div className="flex items-center gap-4 px-5 py-2.5 border-b border-[var(--st-border)] text-[10px] font-medium text-[var(--st-text-secondary)] uppercase tracking-wider">
          <div className="w-9 shrink-0" />
          <div className="flex-1">Name</div>
          <div className="w-20 text-center">Type</div>
          <div className="w-[72px] text-right">Size</div>
          <div className="w-9" />
        </div>

        {loading ? (
          <>
            <AudienceRowSkeleton />
            <AudienceRowSkeleton />
            <AudienceRowSkeleton />
            <AudienceRowSkeleton />
          </>
        ) : filtered.length === 0 ? (
          <div className="py-16">
            <EmptyState
              icon={tab === 'custom' ? Users : Copy}
              title={`No ${tab === 'custom' ? 'custom' : 'lookalike'} audiences`}
              description={
                tab === 'custom'
                  ? 'Create a custom audience from your website visitors, customer lists, or engagement data.'
                  : 'Build lookalike audiences from your existing custom audiences to reach similar people.'
              }
            />
          </div>
        ) : (
          filtered.map((a) => <AudienceRow key={a.id} audience={a} onDelete={handleDelete} />)
        )}
      </Card>

      {/* create sheet */}
      <CreateAudienceSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onCreated={load}
        audiences={audiences}
      />

      {/* sync dialog */}
      <SyncCrmDialog open={syncOpen} onOpenChange={setSyncOpen} onCreated={load} />
    </div>
  );
}
