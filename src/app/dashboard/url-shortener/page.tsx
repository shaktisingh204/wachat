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
  ZoruAlertDialogTrigger,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruCommand,
  ZoruCommandEmpty,
  ZoruCommandGroup,
  ZoruCommandInput,
  ZoruCommandItem,
  ZoruCommandList,
  ZoruInput,
  ZoruLabel,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruPopover,
  ZoruPopoverContent,
  ZoruPopoverTrigger,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSkeleton,
  cn,
  useZoruToast,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition,
  useActionState,
  useRef,
  useCallback,
  useMemo } from 'react';
import { useFormStatus } from 'react-dom';
import {
  createShortUrl,
  getShortUrls,
  deleteShortUrl,
  deleteManyShortUrls,
  } from '@/app/actions/url-shortener.actions';
import type { WithId,
  ShortUrl,
  User,
  Tag,
  CustomDomain } from '@/lib/definitions';
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
  Activity,
  MessageSquare,
  } from 'lucide-react';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { QrCodeDialog } from '@/components/wabasimplify/qr-code-dialog';
import { BulkImportDialog } from '@/components/wabasimplify/bulk-url-import-dialog';
import { CommentsNotesPanel } from '@/components/wabasimplify/comments-notes-panel';
import { DatePicker } from '@/components/ui/date-picker';
import Link from 'next/link';

const initialState: any = { message: null, error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" size="sm" disabled={pending}>
      {pending ? (
        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <LinkIcon className="h-3.5 w-3.5" />
      )}
      Shorten URL
    </ZoruButton>
  );
}

function DeleteButton({ urlId, onDeleted }: { urlId: string; onDeleted: () => void }) {
  const { toast } = useZoruToast();
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
    <ZoruAlertDialog>
      <ZoruAlertDialogTrigger asChild>
        <button
          type="button"
          className="rounded p-1.5 text-zoru-ink-muted hover:bg-zoru-danger/10 hover:text-zoru-danger-ink"
          aria-label="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </ZoruAlertDialogTrigger>
      <ZoruAlertDialogContent>
        <ZoruAlertDialogHeader>
          <ZoruAlertDialogTitle>Are you sure?</ZoruAlertDialogTitle>
          <ZoruAlertDialogDescription>
            This will permanently delete the short link. This action cannot be undone.
          </ZoruAlertDialogDescription>
        </ZoruAlertDialogHeader>
        <ZoruAlertDialogFooter>
          <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
          <ZoruAlertDialogAction onClick={handleDelete} disabled={isPending}>
            {isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />} Delete
          </ZoruAlertDialogAction>
        </ZoruAlertDialogFooter>
      </ZoruAlertDialogContent>
    </ZoruAlertDialog>
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
    <ZoruPopover open={open} onOpenChange={setOpen}>
      <ZoruPopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 w-full items-center justify-between gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg px-3 text-[13px] text-zoru-ink hover:border-zoru-line-strong focus:outline-none focus:border-zoru-ink"
        >
          <span className="truncate">
            {selectedTags.length > 0
              ? selectedTags
                  .map((id) => userTags.find((t) => t._id === id)?.name)
                  .filter(Boolean)
                  .join(', ')
              : placeholder || 'ZoruSelect tags...'}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-zoru-ink-muted" />
        </button>
      </ZoruPopoverTrigger>
      <ZoruPopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <ZoruCommand>
          <ZoruCommandInput placeholder="Search tags..." />
          <ZoruCommandList>
            <ZoruCommandEmpty>No tags found.</ZoruCommandEmpty>
            <ZoruCommandGroup>
              {userTags.map((tag) => (
                <ZoruCommandItem key={tag._id} value={tag.name} onSelect={() => handleSelect(tag._id)}>
                  <Check
                    className={cn('mr-2 h-4 w-4', selectedTags.includes(tag._id) ? 'opacity-100' : 'opacity-0')}
                  />
                  <span className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: tag.color }} />
                  <span>{tag.name}</span>
                </ZoruCommandItem>
              ))}
            </ZoruCommandGroup>
          </ZoruCommandList>
        </ZoruCommand>
      </ZoruPopoverContent>
    </ZoruPopover>
  );
}

function StatCard({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <ZoruCard className="p-4">
      <div className="text-[11px] uppercase tracking-wider text-zoru-ink-muted">{label}</div>
      <div className="mt-1.5 text-[22px] text-zoru-ink leading-tight">{value}</div>
      {hint ? <div className="mt-0.5 text-[11px] text-zoru-ink-muted">{hint}</div> : null}
    </ZoruCard>
  );
}

function ShortenerPageSkeleton() {
  return (
    <div className="flex min-h-full flex-col gap-6">
      <ZoruSkeleton className="h-5 w-48" />
      <ZoruSkeleton className="h-10 w-64" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <ZoruSkeleton key={i} className="h-[88px] rounded-xl" />
        ))}
      </div>
      <ZoruSkeleton className="h-40 w-full rounded-xl" />
      <ZoruSkeleton className="h-64 w-full rounded-xl" />
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
  const { toast } = useZoruToast();
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
  const [createDomainId, setCreateDomainId] = useState<string>('none');

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
  const [notesPanel, setNotesPanel] = useState<{ id: string } | null>(null);

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
      setCreateDomainId('none');
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
    <ZoruBreadcrumb>
      <ZoruBreadcrumbList>
        <ZoruBreadcrumbItem>
          <ZoruBreadcrumbLink href="/dashboard">Home</ZoruBreadcrumbLink>
        </ZoruBreadcrumbItem>
        <ZoruBreadcrumbSeparator />
        <ZoruBreadcrumbItem>
          <ZoruBreadcrumbPage>URL Shortener</ZoruBreadcrumbPage>
        </ZoruBreadcrumbItem>
      </ZoruBreadcrumbList>
    </ZoruBreadcrumb>
  );

  if (!user) {
    return (
      <div className="flex min-h-full flex-col gap-6">
        {breadcrumbs}
        <ZoruCard className="p-10 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-zoru-ink-muted/40 mb-4" />
          <h3 className="text-sm text-zoru-ink mb-1">Not logged in</h3>
          <p className="text-xs text-zoru-ink-muted">Please log in to use the URL Shortener.</p>
        </ZoruCard>
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
      {notesPanel ? (
        <CommentsNotesPanel
          entityId={notesPanel.id}
          entityType="url"
          open={!!notesPanel}
          onOpenChange={(v) => { if (!v) setNotesPanel(null); }}
        />
      ) : null}
      <div className="flex min-h-full flex-col gap-6">
        {breadcrumbs}

        <div className="flex flex-wrap items-start justify-between gap-4">
          <ZoruPageHeader>
            <ZoruPageHeading>
              <ZoruPageTitle>
                <span className="inline-flex items-center gap-3">
                  <LinkIcon className="h-7 w-7" />
                  URL Shortener
                </span>
              </ZoruPageTitle>
              <ZoruPageDescription>
                Create short, trackable links for your campaigns.
              </ZoruPageDescription>
            </ZoruPageHeading>
          </ZoruPageHeader>
          <div className="flex flex-wrap items-center gap-2">
            <ZoruButton
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={filteredUrls.length === 0}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </ZoruButton>
            <Link href="/dashboard/url-shortener/settings">
              <ZoruButton variant="outline" size="sm">
                <SettingsIcon className="h-3.5 w-3.5" />
                Settings
              </ZoruButton>
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
        <ZoruCard className="p-0">
          <form action={formAction} ref={formRef}>
            <input type="hidden" name="tagIds" value={createTagIds.join(',')} />
            <input type="hidden" name="expiresAt" value={expiresAt?.toISOString() || ''} />
            <input type="hidden" name="domainId" value={createDomainId} />
            <div className="border-b border-zoru-line px-5 py-4">
              <h2 className="text-[15px] text-zoru-ink">Create a new short link</h2>
            </div>
            <div className="space-y-4 p-5">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <ZoruLabel htmlFor="originalUrl" className="text-[12.5px] text-zoru-ink-muted">
                    Destination URL
                  </ZoruLabel>
                  <ZoruInput
                    id="originalUrl"
                    name="originalUrl"
                    type="url"
                    placeholder="https://example.com/very-long-url-to-shorten"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <ZoruLabel htmlFor="alias" className="text-[12.5px] text-zoru-ink-muted">
                    Custom Alias (Optional)
                  </ZoruLabel>
                  <ZoruInput id="alias" name="alias" placeholder="e.g., summer-sale" />
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <ZoruLabel className="text-[12.5px] text-zoru-ink-muted">Tags (Optional)</ZoruLabel>
                  <TagsSelector
                    userTags={user?.tags || []}
                    selectedTags={createTagIds}
                    onSelectionChange={setCreateTagIds}
                  />
                </div>
                <div className="space-y-1.5">
                  <ZoruLabel className="text-[12.5px] text-zoru-ink-muted">Expiration Date (Optional)</ZoruLabel>
                  <DatePicker date={expiresAt} setDate={setExpiresAt} />
                </div>
                <div className="space-y-1.5">
                  <ZoruLabel className="text-[12.5px] text-zoru-ink-muted">Custom Domain (Optional)</ZoruLabel>
                  <ZoruSelect value={createDomainId} onValueChange={setCreateDomainId}>
                    <ZoruSelectTrigger>
                      <ZoruSelectValue />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                      {domainOptions.map((opt) => (
                        <ZoruSelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </ZoruSelectItem>
                      ))}
                    </ZoruSelectContent>
                  </ZoruSelect>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-zoru-line bg-zoru-surface-2 px-5 py-3 rounded-b-[var(--zoru-radius-lg)]">
              <SubmitButton />
              <BulkImportDialog onImportComplete={fetchUrls} />
            </div>
          </form>
        </ZoruCard>

        {/* ── Links table with filters ── */}
        <ZoruCard className="p-0">
          <div className="flex flex-wrap items-center gap-3 border-b border-zoru-line px-5 py-3.5">
            <div className="flex-1 min-w-[220px]">
              <ZoruInput
                placeholder="Search links by URL or alias..."
                leadingSlot={<Search />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="min-w-[160px]">
              <ZoruSelect
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as StatusKey)}
              >
                <ZoruSelectTrigger>
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {statusOptions.map((o) => (
                    <ZoruSelectItem key={o.value} value={o.value}>
                      {o.label}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </ZoruSelect>
            </div>
            <div className="min-w-[160px]">
              <ZoruSelect value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                <ZoruSelectTrigger>
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {sortOptions.map((o) => (
                    <ZoruSelectItem key={o.value} value={o.value}>
                      {o.label}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </ZoruSelect>
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
            <div className="flex items-center justify-between gap-3 border-b border-zoru-line bg-zoru-surface-2 px-5 py-2.5 text-[12.5px]">
              <span className="text-zoru-ink">
                <strong>{selectedIds.size}</strong> selected
              </span>
              <div className="flex items-center gap-2">
                <ZoruButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Clear
                </ZoruButton>
                <ZoruAlertDialog>
                  <ZoruAlertDialogTrigger asChild>
                    <ZoruButton size="sm" disabled={isBulkDeleting}>
                      {isBulkDeleting ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Delete selected
                    </ZoruButton>
                  </ZoruAlertDialogTrigger>
                  <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                      <ZoruAlertDialogTitle>Delete {selectedIds.size} link(s)?</ZoruAlertDialogTitle>
                      <ZoruAlertDialogDescription>
                        This permanently removes the selected short links. This action cannot be undone.
                      </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                      <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                      <ZoruAlertDialogAction onClick={handleBulkDelete} disabled={isBulkDeleting}>
                        Delete
                      </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                  </ZoruAlertDialogContent>
                </ZoruAlertDialog>
              </div>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-zoru-line text-left text-[12px] text-zoru-ink-muted">
                  <th className="w-10 px-5 py-3">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={toggleSelectPage}
                      aria-label="ZoruSelect all on page"
                      className="h-3.5 w-3.5 rounded border-zoru-line"
                    />
                  </th>
                  <th className="px-2 py-3">Short URL</th>
                  <th className="px-5 py-3">Destination</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Health</th>
                  <th className="px-5 py-3">Clicks</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-4">
                      <ZoruSkeleton className="h-10 w-full" />
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
                          'border-b border-zoru-line last:border-0 hover:bg-zoru-surface-2',
                          selected && 'bg-zoru-surface-2',
                        )}
                      >
                        <td className="w-10 px-5 py-3">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleSelect(id)}
                            aria-label="ZoruSelect link"
                            className="h-3.5 w-3.5 rounded border-zoru-line"
                          />
                        </td>
                        <td className="px-2 py-3 font-mono">
                          <a
                            href={shortUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-zoru-ink hover:underline flex items-center gap-1"
                          >
                            {shortUrl.replace(/^https?:\/\//, '')}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                handleCopy(id, shortUrl);
                              }}
                              className="ml-1 rounded p-0.5 text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink"
                              aria-label="Copy link"
                            >
                              {copiedId === id ? (
                                <Check className="h-3 w-3 text-zoru-success-ink" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </a>
                        </td>
                        <td className="px-5 py-3 text-zoru-ink-muted truncate max-w-[240px]">
                          {url.originalUrl}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px]',
                              status === 'active' &&
                                'border-zoru-success/40 bg-zoru-success/10 text-zoru-success-ink',
                              status === 'expiring-soon' &&
                                'border-zoru-warning/40 bg-zoru-warning/10 text-zoru-warning-ink',
                              status === 'expired' &&
                                'border-zoru-danger/40 bg-zoru-danger/10 text-zoru-danger-ink',
                            )}
                          >
                            <span
                              className={cn(
                                'inline-block h-1.5 w-1.5 rounded-full',
                                status === 'active' && 'bg-zoru-success',
                                status === 'expiring-soon' && 'bg-zoru-warning',
                                status === 'expired' && 'bg-zoru-danger',
                              )}
                            />
                            {status === 'expiring-soon'
                              ? 'Expiring soon'
                              : status[0].toUpperCase() + status.slice(1)}
                          </span>
                          {url.expiresAt ? (
                            <div className="mt-0.5 text-[10.5px] text-zoru-ink-muted">
                              {new Date(url.expiresAt).toLocaleDateString()}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-5 py-3">
                          {url.healthStatus ? (
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px]',
                                url.healthStatus === 'ok' &&
                                  'border-zoru-success/40 bg-zoru-success/10 text-zoru-success-ink',
                                url.healthStatus === 'dead' &&
                                  'border-zoru-danger/40 bg-zoru-danger/10 text-zoru-danger-ink',
                                url.healthStatus === 'unknown' &&
                                  'border-zoru-line bg-zoru-surface-2 text-zoru-ink-muted',
                              )}
                            >
                              <Activity className="h-2.5 w-2.5" />
                              {url.healthStatus === 'ok' ? 'Up' : url.healthStatus === 'dead' ? 'Down' : 'Unknown'}
                            </span>
                          ) : (
                            <span className="text-[11px] text-zoru-ink-muted/50">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-zoru-ink">{url.clickCount || 0}</td>
                        <td className="px-5 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <Link
                              href={`/dashboard/url-shortener/${id}`}
                              className="rounded p-1.5 text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink"
                              aria-label="Analytics"
                            >
                              <BarChart className="h-3.5 w-3.5" />
                            </Link>
                            <button
                              type="button"
                              onClick={() => setSelectedUrlForQr(shortUrl)}
                              className="rounded p-1.5 text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink"
                              aria-label="QR Code"
                            >
                              <QrCode className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setNotesPanel({ id })}
                              className="rounded p-1.5 text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink"
                              aria-label="Notes & Comments"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                            </button>
                            <DeleteButton urlId={id} onDeleted={fetchUrls} />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-zoru-ink-muted">
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
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zoru-line px-5 py-3 text-[12px] text-zoru-ink-muted">
              <div className="flex items-center gap-2">
                <span>Rows per page</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="h-7 rounded border border-zoru-line bg-zoru-bg px-2 text-[12px] text-zoru-ink"
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
                    className="rounded p-1 text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink disabled:opacity-40 disabled:pointer-events-none"
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
                    className="rounded p-1 text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink disabled:opacity-40 disabled:pointer-events-none"
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </ZoruCard>
      </div>
    </>
  );
}
