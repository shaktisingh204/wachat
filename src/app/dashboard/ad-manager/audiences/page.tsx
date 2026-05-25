'use client';

import {
  Badge,
  Button,
  Card,
  Input,
  Sheet,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetHeader,
  ZoruSheetTitle,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Label,
  Progress,
} from '@/components/zoruui';
import {
  Users,
  Plus,
  Trash2,
  Copy,
  Search,
  Target,
  RefreshCw,
  LoaderCircle,
  Globe } from 'lucide-react';

import { cn } from '@/lib/utils';

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
import { COUNTRIES, formatNumber } from '@/components/wabasimplify/ad-manager/constants';
import { AmBreadcrumb } from '@/app/dashboard/ad-manager/_components/am-page-shell';
import type { CustomAudience } from '@/lib/definitions';

/* ------------------------------------------------------------------ */
/*  Skeleton rows                                                      */
/* ------------------------------------------------------------------ */
function AudienceRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-5 py-4 animate-pulse">
      <div className="h-9 w-9 rounded-full bg-secondary" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-40 rounded bg-secondary" />
        <div className="h-2.5 w-24 rounded bg-secondary" />
      </div>
      <div className="h-6 w-16 rounded-full bg-secondary" />
      <div className="h-3 w-14 rounded bg-secondary" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Empty state                                                        */
/* ------------------------------------------------------------------ */
function EmptyState({ type }: { type: 'custom' | 'lookalike' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary mb-4">
        {type === 'custom' ? (
          <Users className="h-5 w-5 text-muted-foreground" />
        ) : (
          <Copy className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
      <p className="text-[13px] font-medium text-foreground mb-1">
        No {type === 'custom' ? 'custom' : 'lookalike'} audiences
      </p>
      <p className="text-[11px] text-muted-foreground max-w-[240px]">
        {type === 'custom'
          ? 'Create a custom audience from your website visitors, customer lists, or engagement data.'
          : 'Build lookalike audiences from your existing custom audiences to reach similar people.'}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  No-account state                                                   */
/* ------------------------------------------------------------------ */
function NoAccountState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary mb-5">
        <Users className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-[15px] font-medium text-foreground mb-1">No ad account selected</p>
      <p className="text-[13px] text-muted-foreground mb-5 max-w-xs">
        Pick an ad account to view and manage your audiences.
      </p>
      <Link href="/dashboard/ad-manager/ad-accounts">
        <Button variant="default">Go to Ad Accounts</Button>
      </Link>
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

  const badgeVariant = (() => {
    switch (subtype) {
      case 'LOOKALIKE':
        return 'warning' as const;
      case 'WEBSITE':
        return 'info' as const;
      case 'ENGAGEMENT':
        return 'success' as const;
      default:
        return 'secondary' as const;
    }
  })();

  const isPopulating = audience.operation_status?.code === 400 || audience.delivery_status?.code === 400;

  return (
    <>
      <div className="group flex items-center gap-4 px-5 py-3.5 border-b border-border last:border-b-0 hover:bg-secondary/50 transition-colors">
        {/* icon */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary">
          {subtype === 'LOOKALIKE' ? (
            <Copy className="h-4 w-4 text-muted-foreground" />
          ) : subtype === 'WEBSITE' ? (
            <Globe className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Target className="h-4 w-4 text-muted-foreground" />
          )}
        </div>

        {/* name + description */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-foreground truncate">{audience.name}</p>
          {audience.description && (
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">{audience.description}</p>
          )}
          {isPopulating && (
            <div className="mt-2.5 flex items-center gap-2 max-w-[200px]">
              <Progress value={65} className="h-1.5 flex-1" indicatorClassName="bg-warning animate-pulse" />
              <span className="text-[10px] text-muted-foreground font-medium">Populating...</span>
            </div>
          )}
        </div>

        {/* badge */}
        <div className="flex items-center gap-2">
          <Badge variant={badgeVariant}>{subtype}</Badge>
          {isPopulating && (
            <Badge variant="warning" className="animate-pulse bg-warning/20 text-warning-foreground border-warning/50">
              <LoaderCircle className="h-3 w-3 animate-spin mr-1 inline" />
              Populating
            </Badge>
          )}
        </div>

        {/* approximate count */}
        <span className="text-[13px] text-foreground tabular-nums min-w-[72px] text-right">
          {audience.approximate_count_lower_bound === -1 ? 'Under 1000' : audience.approximate_count_lower_bound
            ? formatNumber(audience.approximate_count_lower_bound)
            : '--'}
        </span>

        {/* delete */}
        <Button
          variant="ghost"
          size="icon"
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* delete confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <ZoruDialogContent className="max-w-sm">
          <ZoruDialogHeader>
            <ZoruDialogTitle className="text-[15px]">Delete audience</ZoruDialogTitle>
            <ZoruDialogDescription className="text-[13px] text-muted-foreground">
              Are you sure you want to delete <strong>{audience.name}</strong>? This action cannot be undone.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <ZoruDialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                onDelete(audience.id);
                setConfirmOpen(false);
              }}
            >
              Delete
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab pills (segmented buttons — Zoru has no tab primitive)          */
/* ------------------------------------------------------------------ */
function TabPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-8 px-4 rounded-full text-[12.5px] font-medium transition-all duration-150',
        active
          ? 'bg-foreground text-white shadow-sm'
          : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80',
      )}
    >
      {children}
    </button>
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
  const [customSubtype, setCustomSubtype] = React.useState<'WEBSITE' | 'ENGAGEMENT' | 'CUSTOM'>('WEBSITE');

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
        name: `Lookalike — ${lookRatio}%`,
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
    type === 'custom'
      ? customName.trim().length > 0
      : lookOrigin.length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <ZoruSheetContent side="right" className="w-full sm:max-w-md bg-background overflow-y-auto">
        <ZoruSheetHeader className="mb-6">
          <ZoruSheetTitle className="text-[18px] font-semibold text-foreground">Create audience</ZoruSheetTitle>
          <ZoruSheetDescription className="text-[13px] text-muted-foreground">
            Build a custom or lookalike audience for targeting.
          </ZoruSheetDescription>
        </ZoruSheetHeader>

        {/* type tabs */}
        <div className="flex gap-2 mb-6">
          <TabPill active={type === 'custom'} onClick={() => setType('custom')}>
            Custom Audience
          </TabPill>
          <TabPill active={type === 'lookalike'} onClick={() => setType('lookalike')}>
            Lookalike Audience
          </TabPill>
        </div>

        {type === 'custom' ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Name
              </Label>
              <Input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g. Website visitors — last 30 days"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Description
              </Label>
              <Input
                value={customDesc}
                onChange={(e) => setCustomDesc(e.target.value)}
                placeholder="Optional description"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Source type
              </Label>
              <Select value={customSubtype} onValueChange={(v) => setCustomSubtype(v as typeof customSubtype)}>
                <ZoruSelectTrigger className="h-10 rounded-lg border-border bg-card text-[13px] text-foreground">
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="WEBSITE">Website (Pixel)</ZoruSelectItem>
                  <ZoruSelectItem value="ENGAGEMENT">Engagement</ZoruSelectItem>
                  <ZoruSelectItem value="CUSTOM">Customer list</ZoruSelectItem>
                </ZoruSelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Source audience
              </Label>
              <Select value={lookOrigin} onValueChange={setLookOrigin}>
                <ZoruSelectTrigger className="h-10 rounded-lg border-border bg-card text-[13px] text-foreground">
                  <ZoruSelectValue placeholder="Select a source audience" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {audiences.map((a) => (
                    <ZoruSelectItem key={a.id} value={a.id}>
                      {a.name}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Country
              </Label>
              <Select value={lookCountry} onValueChange={setLookCountry}>
                <ZoruSelectTrigger className="h-10 rounded-lg border-border bg-card text-[13px] text-foreground">
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {COUNTRIES.map((c) => (
                    <ZoruSelectItem key={c.code} value={c.code}>
                      {c.name}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </Select>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  Similarity ratio
                </Label>
                <span className="text-[13px] font-semibold text-foreground tabular-nums">{lookRatio}%</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={lookRatio}
                onChange={(e) => setLookRatio(Number(e.target.value))}
                className="w-full accent-foreground h-1.5 rounded-full appearance-none bg-secondary cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>1% most similar</span>
                <span>10% broadest</span>
              </div>
            </div>
          </div>
        )}

        {/* actions */}
        <div className="flex gap-3 mt-8 pt-5 border-t border-border">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant="default"
            className="flex-1"
            onClick={submit}
            disabled={submitting || !canSubmit}
          >
            {submitting ? 'Creating...' : 'Create audience'}
          </Button>
        </div>
      </ZoruSheetContent>
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
      <ZoruDialogContent className="max-w-md">
        <ZoruDialogHeader>
          <ZoruDialogTitle>Sync CRM Data</ZoruDialogTitle>
          <ZoruDialogDescription>
            Import your Wachat CRM contacts to create a custom audience on Meta.
          </ZoruDialogDescription>
        </ZoruDialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Audience Name
            </Label>
            <Input
              value={audienceName}
              onChange={(e) => setAudienceName(e.target.value)}
              placeholder="e.g. High Value Customers"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              CRM Segment
            </Label>
            <Select value={segment} onValueChange={setSegment}>
              <ZoruSelectTrigger className="h-10 rounded-lg border-border bg-card text-[13px] text-foreground">
                <ZoruSelectValue placeholder="Select segment" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All Contacts</ZoruSelectItem>
                <ZoruSelectItem value="active">Active Subscribers</ZoruSelectItem>
                <ZoruSelectItem value="inactive">Inactive / Churned</ZoruSelectItem>
                <ZoruSelectItem value="high_value">High Value (LTV &gt; $500)</ZoruSelectItem>
              </ZoruSelectContent>
            </Select>
          </div>
        </div>

        <ZoruDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="default" onClick={submit} disabled={submitting || !audienceName.trim()}>
            {submitting ? 'Syncing...' : 'Sync & Create'}
          </Button>
        </ZoruDialogFooter>
      </ZoruDialogContent>
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
  const customAudiences = audiences.filter(
    (a) => (a.subtype || 'CUSTOM') !== 'LOOKALIKE',
  );
  const lookalikeAudiences = audiences.filter(
    (a) => a.subtype === 'LOOKALIKE',
  );

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-[26px] font-semibold tracking-tight text-foreground">Audiences</h1>
          <Badge variant="secondary">
            <span className="tabular-nums">{audiences.length}</span>
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setSyncOpen(true)}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Sync CRM
          </Button>
          <Button
            variant="default"
            onClick={() => setSheetOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Create audience
          </Button>
        </div>
      </div>

      {/* tab pills + search */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-2">
          <TabPill active={tab === 'custom'} onClick={() => setTab('custom')}>
            Custom Audiences
            <span className="ml-1.5 tabular-nums opacity-60">{customAudiences.length}</span>
          </TabPill>
          <TabPill active={tab === 'lookalike'} onClick={() => setTab('lookalike')}>
            Lookalike Audiences
            <span className="ml-1.5 tabular-nums opacity-60">{lookalikeAudiences.length}</span>
          </TabPill>
        </div>

        <Input
          leadingSlot={<Search className="h-3.5 w-3.5" />}
          placeholder="Search audiences..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-[240px]"
        />
      </div>

      {/* audience list */}
      <Card className="p-0 overflow-hidden">
        {/* column header */}
        <div className="flex items-center gap-4 px-5 py-2.5 border-b border-border text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
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
          <EmptyState type={tab} />
        ) : (
          filtered.map((a) => (
            <AudienceRow key={a.id} audience={a} onDelete={handleDelete} />
          ))
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
      <SyncCrmDialog
        open={syncOpen}
        onOpenChange={setSyncOpen}
        onCreated={load}
      />
    </div>
  );
}
