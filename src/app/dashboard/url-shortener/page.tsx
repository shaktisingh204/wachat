'use client';

import { useEffect, useState, useTransition, useActionState, useRef, useCallback, useMemo } from 'react';
import { useFormStatus } from 'react-dom';
import {
  createShortUrl,
  getShortUrls,
  deleteShortUrl,
  deleteManyShortUrls,
} from '@/app/actions/url-shortener.actions';
import type { WithId, ShortUrl, User, Tag, CustomDomain } from '@/lib/definitions';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertCircle,
  Link as LinkIcon,
  LoaderCircle,
  Copy,
  BarChart,
  Trash2,
  QrCode,
  ChevronsUpDown,
  Check,
  Search,
  Download,
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { QrCodeDialog } from '@/components/wabasimplify/qr-code-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { BulkImportDialog } from '@/components/wabasimplify/bulk-url-import-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { DatePicker } from '@/components/ui/date-picker';
import Link from 'next/link';
import { ClayBreadcrumbs, ClayButton, ClayCard, ClayInput, ClaySelect } from '@/components/clay';

const initialState: any = { message: null, error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ClayButton
      type="submit"
      variant="obsidian"
      size="md"
      disabled={pending}
      leading={pending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <LinkIcon className="h-3.5 w-3.5" />}
    >
      Shorten URL
    </ClayButton>
  );
}

function DeleteButton({ urlId, onDeleted }: { urlId: string; onDeleted: () => void }) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteShortUrl(urlId);
      if (result.success) {
        toast({ title: 'Success', description: 'URL deleted.' });
        onDeleted();
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className="rounded p-1.5 text-clay-ink-muted hover:bg-red-500/10 hover:text-red-500"
          aria-label="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the short link. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={isPending}>
            {isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />} Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function TagsSelector({
  userTags,
  selectedTags,
  onSelectionChange,
  placeholder,
}: {
  userTags: Tag[];
  selectedTags: string[];
  onSelectionChange: (tagIds: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const handleSelect = (tagId: string) => {
    const next = selectedTags.includes(tagId)
      ? selectedTags.filter((id) => id !== tagId)
      : [...selectedTags, tagId];
    onSelectionChange(next);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-10 w-full items-center justify-between gap-2 rounded-clay-md border border-clay-border bg-clay-surface px-3 text-[13px] text-clay-ink hover:border-clay-border-strong focus:outline-none focus:border-clay-rose focus:ring-[3px] focus:ring-clay-rose/15"
        >
          <span className="truncate">
            {selectedTags.length > 0
              ? selectedTags
                  .map((id) => userTags.find((t) => t._id === id)?.name)
                  .filter(Boolean)
                  .join(', ')
              : placeholder || 'Select tags...'}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-clay-ink-soft" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search tags..." />
          <CommandList>
            <CommandEmpty>No tags found.</CommandEmpty>
            <CommandGroup>
              {userTags.map((tag) => (
                <CommandItem key={tag._id} value={tag.name} onSelect={() => handleSelect(tag._id)}>
                  <Check
                    className={cn('mr-2 h-4 w-4', selectedTags.includes(tag._id) ? 'opacity-100' : 'opacity-0')}
                  />
                  <span className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: tag.color }} />
                  <span>{tag.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function StatCard({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <ClayCard className="p-4">
      <div className="text-[11px] font-medium uppercase tracking-wider text-clay-ink-muted">{label}</div>
      <div className="mt-1.5 text-[22px] font-semibold text-clay-ink leading-tight">{value}</div>
      {hint ? <div className="mt-0.5 text-[11px] text-clay-ink-muted">{hint}</div> : null}
    </ClayCard>
  );
}

function ShortenerPageSkeleton() {
  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[88px] rounded-clay-lg" />
        ))}
      </div>
      <Skeleton className="h-40 w-full rounded-clay-lg" />
      <Skeleton className="h-64 w-full rounded-clay-lg" />
    </div>
  );
}

type SortKey = 'newest' | 'oldest' | 'most-clicks' | 'least-clicks' | 'alpha';
type StatusKey = 'all' | 'active' | 'expired' | 'expiring-soon';

const PAGE_SIZES = [10, 25, 50, 100];

function downloadCsv(filename: string, rows: string[][]) {
  const escape = (v: string) => {
    if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  };
  const csv = rows.map((r) => r.map((c) => escape(c ?? '')).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function UrlShortenerPage() {
  const { toast } = useToast();
  const { copy } = useCopyToClipboard();

  const [user, setUser] = useState<(Omit<User, 'password'> & { _id: string; tags?: Tag[] }) | null>(null);
  const [urls, setUrls] = useState<WithId<ShortUrl>[]>([]);
  const [domains, setDomains] = useState<WithId<CustomDomain>[]>([]);
  const [isLoading, startLoadingTransition] = useTransition();
  const [isClient, setIsClient] = useState(false);
  const [state, formAction] = useActionState(createShortUrl, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // Create-form state
  const [selectedUrlForQr, setSelectedUrlForQr] = useState<string | null>(null);
  const [createTagIds, setCreateTagIds] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState<Date | undefined>();

  // Feature state: search, filters, sort, selection, pagination, copy-feedback
  const [search, setSearch] = useState('');
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusKey>('all');
  const [sortKey, setSortKey] = useState<SortKey>('newest');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isBulkDeleting, startBulkDelete] = useTransition();

  const fetchUrls = useCallback(() => {
    startLoadingTransition(async () => {
      const { user: u, urls: urlData, domains: d } = await getShortUrls();
      setUser(u);
      setUrls(urlData);
      setDomains(d);
      setSelectedIds(new Set());
    });
  }, []);

  useEffect(() => {
    setIsClient(true);
    fetchUrls();
  }, [fetchUrls]);

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success', description: state.message });
      formRef.current?.reset();
      setCreateTagIds([]);
      setExpiresAt(undefined);
      fetchUrls();
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, fetchUrls]);

  const getShortUrl = useCallback(
    (url: WithId<ShortUrl>) => {
      if (typeof window === 'undefined') return '';
      const domain = domains.find((d) => d._id.toString() === url.domainId)?.hostname || window.location.origin;
      const protocol = domain.startsWith('http') ? '' : 'https://';
      if (domain.startsWith('http')) return `${domain}/s/${url.shortCode}`;
      return url.domainId ? `${protocol}${domain}/${url.shortCode}` : `${domain}/s/${url.shortCode}`;
    },
    [domains],
  );

  // ── Derived: filtered + sorted list ────────────────────────────────
  const nowMs = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  const getStatus = useCallback(
    (url: WithId<ShortUrl>): 'active' | 'expired' | 'expiring-soon' => {
      if (!url.expiresAt) return 'active';
      const exp = new Date(url.expiresAt).getTime();
      if (exp < nowMs) return 'expired';
      if (exp - nowMs <= sevenDaysMs) return 'expiring-soon';
      return 'active';
    },
    [nowMs],
  );

  const filteredUrls = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = urls.filter((u) => {
      if (q) {
        const hay = `${u.originalUrl} ${u.shortCode}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filterTagIds.length > 0) {
        const urlTagIds = (u.tagIds || []).map(String);
        const ok = filterTagIds.every((id) => urlTagIds.includes(id));
        if (!ok) return false;
      }
      if (statusFilter !== 'all' && getStatus(u) !== statusFilter) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      switch (sortKey) {
        case 'oldest':
          return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
        case 'most-clicks':
          return (b.clickCount || 0) - (a.clickCount || 0);
        case 'least-clicks':
          return (a.clickCount || 0) - (b.clickCount || 0);
        case 'alpha':
          return (a.shortCode || '').localeCompare(b.shortCode || '');
        case 'newest':
        default:
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
    });
    return list;
  }, [urls, search, filterTagIds, statusFilter, sortKey, getStatus]);

  // Pagination clamp
  const pageCount = Math.max(1, Math.ceil(filteredUrls.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageSlice = filteredUrls.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  useEffect(() => {
    // Reset to page 1 when filters change
    setPage(1);
  }, [search, filterTagIds, statusFilter, sortKey, pageSize]);

  // ── Stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = urls.length;
    const totalClicks = urls.reduce((sum, u) => sum + (u.clickCount || 0), 0);
    let active = 0;
    let expired = 0;
    let expiringSoon = 0;
    for (const u of urls) {
      const s = getStatus(u);
      if (s === 'active') active++;
      else if (s === 'expired') expired++;
      else expiringSoon++;
    }
    return { total, totalClicks, active, expired, expiringSoon };
  }, [urls, getStatus]);

  // ── Selection helpers ──────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };
  const allPageSelected =
    pageSlice.length > 0 && pageSlice.every((u) => selectedIds.has(u._id.toString()));
  const toggleSelectPage = () => {
    const next = new Set(selectedIds);
    if (allPageSelected) {
      pageSlice.forEach((u) => next.delete(u._id.toString()));
    } else {
      pageSlice.forEach((u) => next.add(u._id.toString()));
    }
    setSelectedIds(next);
  };

  const handleBulkDelete = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    startBulkDelete(async () => {
      const result = await deleteManyShortUrls(ids);
      if (result.success) {
        toast({ title: 'Deleted', description: `${result.deleted ?? ids.length} links removed.` });
        fetchUrls();
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    });
  };

  const handleExport = () => {
    const rows: string[][] = [
      ['Short URL', 'Destination', 'Clicks', 'Tags', 'Expires At', 'Created At'],
    ];
    for (const u of filteredUrls) {
      const tagNames = (u.tagIds || [])
        .map((id) => user?.tags?.find((t) => t._id === id)?.name || '')
        .filter(Boolean)
        .join('|');
      rows.push([
        getShortUrl(u),
        u.originalUrl,
        String(u.clickCount || 0),
        tagNames,
        u.expiresAt ? new Date(u.expiresAt).toISOString() : '',
        u.createdAt ? new Date(u.createdAt).toISOString() : '',
      ]);
    }
    downloadCsv(`short-urls-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  const handleCopy = (id: string, value: string) => {
    copy(value);
    setCopiedId(id);
    setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
  };

  if (!isClient) return <ShortenerPageSkeleton />;

  const breadcrumbs = (
    <ClayBreadcrumbs
      items={[
        { label: 'Home', href: '/home' },
        { label: 'URL Shortener' },
      ]}
    />
  );

  if (!user) {
    return (
      <div className="clay-enter flex min-h-full flex-col gap-6">
        {breadcrumbs}
        <ClayCard className="p-10 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-clay-ink-muted/30 mb-4" />
          <h3 className="text-sm font-medium text-clay-ink mb-1">Not logged in</h3>
          <p className="text-xs text-clay-ink-muted">Please log in to use the URL Shortener.</p>
        </ClayCard>
      </div>
    );
  }

  const verifiedDomains = domains.filter((d) => d.verified);
  const domainOptions = [
    { value: 'none', label: 'Default Domain' },
    ...verifiedDomains.map((d) => ({ value: d._id.toString(), label: d.hostname })),
  ];

  const sortOptions: Array<{ value: SortKey; label: string }> = [
    { value: 'newest', label: 'Newest first' },
    { value: 'oldest', label: 'Oldest first' },
    { value: 'most-clicks', label: 'Most clicks' },
    { value: 'least-clicks', label: 'Least clicks' },
    { value: 'alpha', label: 'Alias A–Z' },
  ];

  const statusOptions: Array<{ value: StatusKey; label: string }> = [
    { value: 'all', label: 'All statuses' },
    { value: 'active', label: 'Active' },
    { value: 'expiring-soon', label: 'Expiring soon' },
    { value: 'expired', label: 'Expired' },
  ];

  return (
    <>
      <QrCodeDialog
        dataString={selectedUrlForQr}
        open={!!selectedUrlForQr}
        onOpenChange={(open) => !open && setSelectedUrlForQr(null)}
      />
      <div className="clay-enter flex min-h-full flex-col gap-6">
        {breadcrumbs}

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1] flex items-center gap-3">
              <LinkIcon className="h-7 w-7" />
              URL Shortener
            </h1>
            <p className="mt-1.5 max-w-[720px] text-[13px] text-clay-ink-muted">
              Create short, trackable links for your campaigns.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ClayButton
              variant="pill"
              size="sm"
              onClick={handleExport}
              disabled={filteredUrls.length === 0}
              leading={<Download className="h-3.5 w-3.5" />}
            >
              Export CSV
            </ClayButton>
            <Link href="/dashboard/url-shortener/settings">
              <ClayButton
                variant="pill"
                size="sm"
                leading={<SettingsIcon className="h-3.5 w-3.5" />}
              >
                Settings
              </ClayButton>
            </Link>
          </div>
        </div>

        {/* ── Stats cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Links" value={stats.total} />
          <StatCard label="Total Clicks" value={stats.totalClicks.toLocaleString()} />
          <StatCard label="Active" value={stats.active} hint={`${stats.expiringSoon} expiring soon`} />
          <StatCard label="Expired" value={stats.expired} />
        </div>

        {/* ── Create form ── */}
        <ClayCard padded={false}>
          <form action={formAction} ref={formRef}>
            <input type="hidden" name="tagIds" value={createTagIds.join(',')} />
            <input type="hidden" name="expiresAt" value={expiresAt?.toISOString() || ''} />
            <div className="border-b border-clay-border px-5 py-4">
              <h2 className="text-[15px] font-semibold text-clay-ink">Create a new short link</h2>
            </div>
            <div className="space-y-4 p-5">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="originalUrl" className="text-[12.5px] text-clay-ink-muted">
                    Destination URL
                  </Label>
                  <ClayInput
                    id="originalUrl"
                    name="originalUrl"
                    type="url"
                    placeholder="https://example.com/very-long-url-to-shorten"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="alias" className="text-[12.5px] text-clay-ink-muted">
                    Custom Alias (Optional)
                  </Label>
                  <ClayInput id="alias" name="alias" placeholder="e.g., summer-sale" />
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[12.5px] text-clay-ink-muted">Tags (Optional)</Label>
                  <TagsSelector
                    userTags={user?.tags || []}
                    selectedTags={createTagIds}
                    onSelectionChange={setCreateTagIds}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12.5px] text-clay-ink-muted">Expiration Date (Optional)</Label>
                  <DatePicker date={expiresAt} setDate={setExpiresAt} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12.5px] text-clay-ink-muted">Custom Domain (Optional)</Label>
                  <ClaySelect name="domainId" options={domainOptions} defaultValue="none" />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-clay-border bg-clay-surface-2 px-5 py-3 rounded-b-clay-lg">
              <SubmitButton />
              <BulkImportDialog onImportComplete={fetchUrls} />
            </div>
          </form>
        </ClayCard>

        {/* ── Links table with filters ── */}
        <ClayCard padded={false}>
          <div className="flex flex-wrap items-center gap-3 border-b border-clay-border px-5 py-3.5">
            <div className="flex-1 min-w-[220px]">
              <ClayInput
                sizeVariant="sm"
                placeholder="Search links by URL or alias..."
                leading={<Search className="h-3.5 w-3.5" />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="min-w-[160px]">
              <ClaySelect
                sizeVariant="sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusKey)}
                options={statusOptions}
              />
            </div>
            <div className="min-w-[160px]">
              <ClaySelect
                sizeVariant="sm"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                options={sortOptions}
              />
            </div>
            {user?.tags && user.tags.length > 0 ? (
              <div className="min-w-[180px] max-w-[240px]">
                <TagsSelector
                  userTags={user.tags}
                  selectedTags={filterTagIds}
                  onSelectionChange={setFilterTagIds}
                  placeholder="Filter by tag..."
                />
              </div>
            ) : null}
          </div>

          {selectedIds.size > 0 ? (
            <div className="flex items-center justify-between gap-3 border-b border-clay-border bg-clay-rose-soft/40 px-5 py-2.5 text-[12.5px]">
              <span className="text-clay-ink">
                <strong>{selectedIds.size}</strong> selected
              </span>
              <div className="flex items-center gap-2">
                <ClayButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Clear
                </ClayButton>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <ClayButton
                      variant="rose"
                      size="sm"
                      disabled={isBulkDeleting}
                      leading={
                        isBulkDeleting ? (
                          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )
                      }
                    >
                      Delete selected
                    </ClayButton>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {selectedIds.size} link(s)?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This permanently removes the selected short links. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleBulkDelete} disabled={isBulkDeleting}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-clay-border text-left text-[12px] text-clay-ink-muted">
                  <th className="w-10 px-5 py-3">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={toggleSelectPage}
                      aria-label="Select all on page"
                      className="h-3.5 w-3.5 rounded border-clay-border"
                    />
                  </th>
                  <th className="px-2 py-3 font-medium">Short URL</th>
                  <th className="px-5 py-3 font-medium">Destination</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Clicks</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-4">
                      <Skeleton className="h-10 w-full" />
                    </td>
                  </tr>
                ) : pageSlice.length > 0 ? (
                  pageSlice.map((url) => {
                    const id = url._id.toString();
                    const shortUrl = getShortUrl(url);
                    const status = getStatus(url);
                    const selected = selectedIds.has(id);
                    return (
                      <tr
                        key={id}
                        className={cn(
                          'border-b border-clay-border last:border-0 hover:bg-clay-surface-2',
                          selected && 'bg-clay-rose-soft/30',
                        )}
                      >
                        <td className="w-10 px-5 py-3">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleSelect(id)}
                            aria-label="Select link"
                            className="h-3.5 w-3.5 rounded border-clay-border"
                          />
                        </td>
                        <td className="px-2 py-3 font-mono">
                          <a
                            href={shortUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-clay-accent hover:underline flex items-center gap-1"
                          >
                            {shortUrl.replace(/^https?:\/\//, '')}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                handleCopy(id, shortUrl);
                              }}
                              className="ml-1 rounded p-0.5 text-clay-ink-muted hover:bg-clay-bg-2 hover:text-clay-ink"
                              aria-label="Copy link"
                            >
                              {copiedId === id ? (
                                <Check className="h-3 w-3 text-clay-green" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </a>
                        </td>
                        <td className="px-5 py-3 text-clay-ink-muted truncate max-w-[240px]">
                          {url.originalUrl}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-medium',
                              status === 'active' &&
                                'border-clay-green/40 bg-clay-green/10 text-clay-green',
                              status === 'expiring-soon' &&
                                'border-clay-amber/40 bg-clay-amber/10 text-clay-amber',
                              status === 'expired' &&
                                'border-red-500/40 bg-red-500/10 text-red-500',
                            )}
                          >
                            <span
                              className={cn(
                                'inline-block h-1.5 w-1.5 rounded-full',
                                status === 'active' && 'bg-clay-green',
                                status === 'expiring-soon' && 'bg-clay-amber',
                                status === 'expired' && 'bg-red-500',
                              )}
                            />
                            {status === 'expiring-soon'
                              ? 'Expiring soon'
                              : status[0].toUpperCase() + status.slice(1)}
                          </span>
                          {url.expiresAt ? (
                            <div className="mt-0.5 text-[10.5px] text-clay-ink-muted">
                              {new Date(url.expiresAt).toLocaleDateString()}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-5 py-3 text-clay-ink font-medium">{url.clickCount || 0}</td>
                        <td className="px-5 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <Link
                              href={`/dashboard/url-shortener/${id}`}
                              className="rounded p-1.5 text-clay-ink-muted hover:bg-clay-bg-2 hover:text-clay-ink"
                              aria-label="Analytics"
                            >
                              <BarChart className="h-3.5 w-3.5" />
                            </Link>
                            <button
                              type="button"
                              onClick={() => setSelectedUrlForQr(shortUrl)}
                              className="rounded p-1.5 text-clay-ink-muted hover:bg-clay-bg-2 hover:text-clay-ink"
                              aria-label="QR Code"
                            >
                              <QrCode className="h-3.5 w-3.5" />
                            </button>
                            <DeleteButton urlId={id} onDeleted={fetchUrls} />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-clay-ink-muted">
                      {urls.length === 0
                        ? 'No links created yet.'
                        : 'No links match your filters.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredUrls.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-clay-border px-5 py-3 text-[12px] text-clay-ink-muted">
              <div className="flex items-center gap-2">
                <span>Rows per page</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="h-7 rounded border border-clay-border bg-clay-surface px-2 text-[12px] text-clay-ink"
                >
                  {PAGE_SIZES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span>
                  {(currentPage - 1) * pageSize + 1}–
                  {Math.min(currentPage * pageSize, filteredUrls.length)} of {filteredUrls.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="rounded p-1 text-clay-ink-muted hover:bg-clay-bg-2 hover:text-clay-ink disabled:opacity-40 disabled:pointer-events-none"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="min-w-[48px] text-center">
                    {currentPage} / {pageCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                    disabled={currentPage >= pageCount}
                    className="rounded p-1 text-clay-ink-muted hover:bg-clay-bg-2 hover:text-clay-ink disabled:opacity-40 disabled:pointer-events-none"
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </ClayCard>
      </div>
    </>
  );
}
