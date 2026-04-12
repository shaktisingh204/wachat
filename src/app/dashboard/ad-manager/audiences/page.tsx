'use client';

import * as React from 'react';
import Link from 'next/link';
import { LuUsers, LuPlus, LuTrash2, LuCopy, LuSearch, LuTarget, LuGlobe } from 'react-icons/lu';

import { cn } from '@/lib/utils';
import { ClayBreadcrumbs } from '@/components/clay/clay-breadcrumbs';
import { ClayButton } from '@/components/clay/clay-button';
import { ClayCard } from '@/components/clay/clay-card';
import { ClayInput } from '@/components/clay/clay-input';
import { ClayBadge } from '@/components/clay/clay-badge';
import { useToast } from '@/hooks/use-toast';
import { useAdManager } from '@/context/ad-manager-context';
import {
  getCustomAudiences,
  createCustomAudience,
  createLookalikeAudience,
  deleteCustomAudience,
} from '@/app/actions/ad-manager.actions';
import { COUNTRIES, formatNumber } from '@/components/wabasimplify/ad-manager/constants';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CustomAudience } from '@/lib/definitions';

/* ------------------------------------------------------------------ */
/*  Skeleton rows                                                      */
/* ------------------------------------------------------------------ */
function AudienceRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-5 py-4 animate-pulse">
      <div className="h-9 w-9 rounded-full bg-clay-surface-2" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-40 rounded bg-clay-surface-2" />
        <div className="h-2.5 w-24 rounded bg-clay-surface-2" />
      </div>
      <div className="h-6 w-16 rounded-full bg-clay-surface-2" />
      <div className="h-3 w-14 rounded bg-clay-surface-2" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Empty state                                                        */
/* ------------------------------------------------------------------ */
function EmptyState({ type }: { type: 'custom' | 'lookalike' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-clay-surface-2 mb-4">
        {type === 'custom' ? (
          <LuUsers className="h-5 w-5 text-clay-ink-soft" />
        ) : (
          <LuCopy className="h-5 w-5 text-clay-ink-soft" />
        )}
      </div>
      <p className="text-[13px] font-medium text-clay-ink mb-1">
        No {type === 'custom' ? 'custom' : 'lookalike'} audiences
      </p>
      <p className="text-[11px] text-clay-ink-muted max-w-[240px]">
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
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-clay-surface-2 mb-5">
        <LuUsers className="h-6 w-6 text-clay-ink-soft" />
      </div>
      <p className="text-[15px] font-medium text-clay-ink mb-1">No ad account selected</p>
      <p className="text-[13px] text-clay-ink-muted mb-5 max-w-xs">
        Pick an ad account to view and manage your audiences.
      </p>
      <Link href="/dashboard/ad-manager/ad-accounts">
        <ClayButton variant="obsidian">Go to Ad Accounts</ClayButton>
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

  const badgeTone = (() => {
    switch (subtype) {
      case 'LOOKALIKE':
        return 'amber' as const;
      case 'WEBSITE':
        return 'blue' as const;
      case 'ENGAGEMENT':
        return 'green' as const;
      default:
        return 'neutral' as const;
    }
  })();

  return (
    <>
      <div className="group flex items-center gap-4 px-5 py-3.5 border-b border-clay-border last:border-b-0 hover:bg-clay-surface-2/50 transition-colors">
        {/* icon */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-clay-surface-2">
          {subtype === 'LOOKALIKE' ? (
            <LuCopy className="h-4 w-4 text-clay-ink-soft" />
          ) : subtype === 'WEBSITE' ? (
            <LuGlobe className="h-4 w-4 text-clay-ink-soft" />
          ) : (
            <LuTarget className="h-4 w-4 text-clay-ink-soft" />
          )}
        </div>

        {/* name + description */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-clay-ink truncate">{audience.name}</p>
          {audience.description && (
            <p className="text-[11px] text-clay-ink-muted truncate mt-0.5">{audience.description}</p>
          )}
        </div>

        {/* badge */}
        <ClayBadge tone={badgeTone} dot>
          {subtype}
        </ClayBadge>

        {/* approximate count */}
        <span className="text-[13px] text-clay-ink tabular-nums min-w-[72px] text-right">
          {audience.approximate_count_lower_bound
            ? formatNumber(audience.approximate_count_lower_bound)
            : '--'}
        </span>

        {/* delete */}
        <ClayButton
          variant="ghost"
          size="icon"
          className="opacity-0 group-hover:opacity-100 text-clay-ink-muted hover:text-clay-red"
          onClick={() => setConfirmOpen(true)}
        >
          <LuTrash2 className="h-4 w-4" />
        </ClayButton>
      </div>

      {/* delete confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[15px]">Delete audience</DialogTitle>
            <DialogDescription className="text-[13px] text-clay-ink-muted">
              Are you sure you want to delete <strong>{audience.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <ClayButton variant="pill" size="sm" onClick={() => setConfirmOpen(false)}>
              Cancel
            </ClayButton>
            <ClayButton
              variant="rose"
              size="sm"
              className="bg-clay-red hover:bg-clay-red/90"
              onClick={() => {
                onDelete(audience.id);
                setConfirmOpen(false);
              }}
            >
              Delete
            </ClayButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab pills                                                          */
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
          ? 'bg-clay-obsidian text-white shadow-sm'
          : 'bg-clay-surface-2 text-clay-ink-muted hover:text-clay-ink hover:bg-clay-surface-2/80',
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
      <SheetContent side="right" className="w-full sm:max-w-md bg-clay-bg overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-[18px] font-semibold text-clay-ink">Create audience</SheetTitle>
          <SheetDescription className="text-[13px] text-clay-ink-muted">
            Build a custom or lookalike audience for targeting.
          </SheetDescription>
        </SheetHeader>

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
              <Label className="text-[11px] font-medium text-clay-ink-muted uppercase tracking-wide">
                Name
              </Label>
              <ClayInput
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g. Website visitors — last 30 days"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-clay-ink-muted uppercase tracking-wide">
                Description
              </Label>
              <ClayInput
                value={customDesc}
                onChange={(e) => setCustomDesc(e.target.value)}
                placeholder="Optional description"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-clay-ink-muted uppercase tracking-wide">
                Source type
              </Label>
              <Select value={customSubtype} onValueChange={(v) => setCustomSubtype(v as typeof customSubtype)}>
                <SelectTrigger className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px] text-clay-ink">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WEBSITE">Website (Pixel)</SelectItem>
                  <SelectItem value="ENGAGEMENT">Engagement</SelectItem>
                  <SelectItem value="CUSTOM">Customer list</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-clay-ink-muted uppercase tracking-wide">
                Source audience
              </Label>
              <Select value={lookOrigin} onValueChange={setLookOrigin}>
                <SelectTrigger className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px] text-clay-ink">
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
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-clay-ink-muted uppercase tracking-wide">
                Country
              </Label>
              <Select value={lookCountry} onValueChange={setLookCountry}>
                <SelectTrigger className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px] text-clay-ink">
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
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-medium text-clay-ink-muted uppercase tracking-wide">
                  Similarity ratio
                </Label>
                <span className="text-[13px] font-semibold text-clay-ink tabular-nums">{lookRatio}%</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={lookRatio}
                onChange={(e) => setLookRatio(Number(e.target.value))}
                className="w-full accent-clay-obsidian h-1.5 rounded-full appearance-none bg-clay-surface-2 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-clay-ink-muted">
                <span>1% most similar</span>
                <span>10% broadest</span>
              </div>
            </div>
          </div>
        )}

        {/* actions */}
        <div className="flex gap-3 mt-8 pt-5 border-t border-clay-border">
          <ClayButton
            variant="pill"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </ClayButton>
          <ClayButton
            variant="obsidian"
            className="flex-1"
            onClick={submit}
            disabled={submitting || !canSubmit}
          >
            {submitting ? 'Creating...' : 'Create audience'}
          </ClayButton>
        </div>
      </SheetContent>
    </Sheet>
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
    <div className="flex flex-col gap-6 p-6">
      {/* breadcrumbs */}
      <ClayBreadcrumbs
        items={[
          { label: 'SabNode', href: '/dashboard' },
          { label: 'Meta Suite', href: '/dashboard/ad-manager' },
          { label: 'Audiences' },
        ]}
      />

      {/* header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-[26px] font-semibold tracking-tight text-clay-ink">Audiences</h1>
          <ClayBadge tone="neutral">
            <span className="tabular-nums">{audiences.length}</span>
          </ClayBadge>
        </div>
        <ClayButton
          variant="obsidian"
          leading={<LuPlus className="h-4 w-4" />}
          onClick={() => setSheetOpen(true)}
        >
          Create audience
        </ClayButton>
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

        <ClayInput
          sizeVariant="sm"
          leading={<LuSearch className="h-3.5 w-3.5" />}
          placeholder="Search audiences..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-[240px]"
        />
      </div>

      {/* audience list */}
      <ClayCard padded={false}>
        {/* column header */}
        <div className="flex items-center gap-4 px-5 py-2.5 border-b border-clay-border text-[10px] font-medium text-clay-ink-muted uppercase tracking-wider">
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
      </ClayCard>

      {/* create sheet */}
      <CreateAudienceSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onCreated={load}
        audiences={audiences}
      />
    </div>
  );
}
