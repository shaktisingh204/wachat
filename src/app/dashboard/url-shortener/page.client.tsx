'use client';

import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Card, PageDescription, PageHeader, PageHeading, PageTitle, Skeleton, useToast } from '@/components/sabcrm/20ui/compat';
import {
  useEffect,
  useState,
  useTransition,
  useCallback,
  useMemo,
} from 'react';
import { getShortUrls } from '@/app/actions/url-shortener.actions';
import { getCollections } from '@/app/actions/url-collections.actions';
import type {
  WithId,
  ShortUrl,
  User,
  Tag,
  CustomDomain,
} from '@/lib/definitions';
import {
  AlertCircle,
  Link as LinkIcon,
  Download,
  Settings as SettingsIcon,
} from 'lucide-react';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { QrCodeDialog } from '@/components/zoruui-domain/qr-code-dialog';
import { CommentsNotesPanel } from '@/components/zoruui-domain/comments-notes-panel';
import { UrlShortenerSidebar } from '@/components/zoruui-domain/url-shortener-sidebar';
import Link from 'next/link';

// Extracted Components
import { UrlShortenerStats } from './components/UrlShortenerStats';
import { UrlShortenerGeoAnalytics } from './components/UrlShortenerGeoAnalytics';
import { UrlShortenerForm } from './components/UrlShortenerForm';
import { UrlShortenerTable } from './components/UrlShortenerTable';

function ShortenerPageSkeleton() {
  return (
    <div className="flex min-h-full flex-col gap-6">
      <Skeleton className="h-4 w-32" />
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[90px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-[120px] rounded-xl" />
      <Skeleton className="h-[300px] rounded-xl" />
      <div className="flex gap-4">
        <Skeleton className="h-[400px] w-64 rounded-xl hidden lg:block" />
        <Skeleton className="h-[400px] flex-1 rounded-xl" />
      </div>
    </div>
  );
}

type SortKey = 'newest' | 'oldest' | 'most-clicks' | 'least-clicks' | 'alpha';
type StatusKey = 'all' | 'active' | 'expired' | 'expiring-soon';

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

  // Feature state: search, filters, sort, selection, pagination, copy-feedback
  const [search, setSearch] = useState('');
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusKey>('all');
  const [sortKey, setSortKey] = useState<SortKey>('newest');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [notesPanel, setNotesPanel] = useState<{ id: string } | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [collections, setCollections] = useState<{ _id: string; name: string; color: string; linkIds: string[] }[]>([]);
  const [selectedUrlForQr, setSelectedUrlForQr] = useState<string | null>(null);

  const fetchUrls = useCallback(() => {
    startLoadingTransition(async () => {
      try {
        const [{ user: u, urls: urlData, domains: d }, cols] = await Promise.all([
          getShortUrls(),
          getCollections(),
        ]);
        setUser(u);
        setUrls(urlData);
        setDomains(d);
        setCollections(cols);
        setSelectedIds(new Set());
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to fetch links.', variant: 'destructive' });
      }
    });
  }, [toast]);

  useEffect(() => {
    setIsClient(true);
    fetchUrls();
  }, [fetchUrls]);

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
      if (selectedCollectionId) {
        const col = collections.find((c) => c._id === selectedCollectionId);
        if (!(col?.linkIds.includes(u._id.toString()) ?? false)) return false;
      }
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
  }, [urls, search, filterTagIds, statusFilter, sortKey, getStatus, selectedCollectionId, collections]);

  // Pagination clamp
  const pageCount = Math.max(1, Math.ceil(filteredUrls.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageSlice = filteredUrls.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  useEffect(() => {
    setPage(1);
  }, [search, filterTagIds, statusFilter, sortKey, pageSize, selectedCollectionId]);

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
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/dashboard">Home</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>URL Shortener</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );

  if (!user) {
    return (
      <div className="flex min-h-full flex-col gap-6">
        {breadcrumbs}
        <Card className="p-10 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-[var(--st-text-secondary)]/40 mb-4" />
          <h3 className="text-sm text-[var(--st-text)] mb-1">Not logged in</h3>
          <p className="text-xs text-[var(--st-text-secondary)]">Please log in to use the URL Shortener.</p>
        </Card>
      </div>
    );
  }

  const verifiedDomains = domains.filter((d) => d.verified);
  const domainOptions = [
    { value: 'none', label: 'Default Domain' },
    ...verifiedDomains.map((d) => ({ value: d._id.toString(), label: d.hostname })),
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
          <PageHeader>
            <PageHeading>
              <PageTitle>
                <span className="inline-flex items-center gap-3">
                  <LinkIcon className="h-7 w-7" />
                  URL Shortener
                </span>
              </PageTitle>
              <PageDescription>
                Create short, trackable links for your campaigns.
              </PageDescription>
            </PageHeading>
          </PageHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={filteredUrls.length === 0}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
            <Link href="/dashboard/url-shortener/settings">
              <Button variant="outline" size="sm">
                <SettingsIcon className="h-3.5 w-3.5" />
                Settings
              </Button>
            </Link>
          </div>
        </div>

        {/* ── Stats cards ── */}
        <UrlShortenerStats urls={urls} getStatus={getStatus} />
        
        {/* ── Geo Analytics ── */}
        <UrlShortenerGeoAnalytics urls={urls} />

        {/* ── Create form ── */}
        <UrlShortenerForm 
          userTags={user?.tags || []} 
          domainOptions={domainOptions} 
          onSuccess={fetchUrls} 
        />

        {/* ── Links table with sidebar filters ── */}
        <div className="flex flex-col lg:flex-row gap-4">
          <UrlShortenerSidebar
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            sortKey={sortKey}
            onSortChange={setSortKey}
            userTags={user?.tags || []}
            filterTagIds={filterTagIds}
            onFilterTagsChange={setFilterTagIds}
            selectedCollectionId={selectedCollectionId}
            onSelectCollection={setSelectedCollectionId}
          />
          <div className="flex-1 min-w-0">
            <UrlShortenerTable
              urls={urls}
              filteredUrls={filteredUrls}
              pageSlice={pageSlice}
              isLoading={isLoading}
              selectedIds={selectedIds}
              setSelectedIds={setSelectedIds}
              allPageSelected={allPageSelected}
              toggleSelectPage={toggleSelectPage}
              toggleSelect={toggleSelect}
              page={page}
              setPage={setPage}
              pageSize={pageSize}
              setPageSize={setPageSize}
              pageCount={pageCount}
              currentPage={currentPage}
              getShortUrl={getShortUrl}
              getStatus={getStatus}
              copiedId={copiedId}
              handleCopy={handleCopy}
              setSelectedUrlForQr={setSelectedUrlForQr}
              setNotesPanel={setNotesPanel}
              fetchUrls={fetchUrls}
            />
          </div>
        </div>
      </div>
    </>
  );
}
