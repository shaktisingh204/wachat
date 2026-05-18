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
  ZoruInput,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
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
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition } from 'react';
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  LoaderCircle,
  QrCode,
  Search,
  Trash2,
  } from 'lucide-react';
import Link from 'next/link';
import { getSession } from '@/app/actions/index';
import { deleteManyQrCodes,
  deleteQrCode,
  getQrCodes } from '@/app/actions/qr-code.actions';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { QrCodeGenerator } from '@/components/wabasimplify/qr-code-generator';
import { QrCodeDialog } from '@/components/wabasimplify/qr-code-dialog';
import { normalizeQrWebsiteUrl } from '@/lib/qr-utils';

export const dynamic = 'force-dynamic';

type SortKey = 'newest' | 'oldest' | 'name-asc' | 'name-desc';
type DynamicFilter = 'all' | 'dynamic' | 'static';
type TypeFilter = 'all' | 'url' | 'text' | 'email' | 'phone' | 'sms' | 'wifi';

const PAGE_SIZES = [10, 25, 50];
const RECENT_MS = 24 * 60 * 60 * 1000;

const typeOptions: Array<{ value: TypeFilter; label: string }> = [
  { value: 'all', label: 'All types' },
  { value: 'url', label: 'URL' },
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'sms', label: 'SMS' },
  { value: 'wifi', label: 'WiFi' },
];

const sortOptions: Array<{ value: SortKey; label: string }> = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'name-asc', label: 'Name A–Z' },
  { value: 'name-desc', label: 'Name Z–A' },
];

const dynamicOptions: Array<{ value: DynamicFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'dynamic', label: 'Dynamic only' },
  { value: 'static', label: 'Static only' },
];

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

function StatCard({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <ZoruCard className="p-4">
      <div className="text-[11px] uppercase tracking-wider text-zoru-ink-muted">{label}</div>
      <div className="mt-1.5 text-[22px] text-zoru-ink leading-tight">{value}</div>
      {hint ? <div className="mt-0.5 text-[11px] text-zoru-ink-muted">{hint}</div> : null}
    </ZoruCard>
  );
}

function generateDataString(code: any): string {
  if (code.dataType === 'url' && code.shortUrl) {
    const domain = typeof window !== 'undefined' ? window.location.origin : '';
    return `${domain}/s/${code.shortUrl.shortCode}`;
  }
  switch (code.dataType) {
    case 'url':
      return normalizeQrWebsiteUrl(code.data?.url || '');
    case 'text':
      return code.data?.text || '';
    case 'email':
      return `mailto:${code.data?.email || ''}?subject=${encodeURIComponent(code.data?.emailSubject || '')}&body=${encodeURIComponent(code.data?.emailBody || '')}`;
    case 'phone':
      return `tel:${code.data?.phone || ''}`;
    case 'sms':
      return `smsto:${code.data?.sms || ''}:${encodeURIComponent(code.data?.smsMessage || '')}`;
    case 'wifi':
      return `WIFI:T:${code.data?.wifiEncryption || ''};S:${code.data?.wifiSsid || ''};P:${code.data?.wifiPassword || ''};;`;
    default:
      return '';
  }
}

export default function QrCodeMakerPage() {
  const { toast } = useZoruToast();
  const { copy } = useCopyToClipboard();

  const [session, setSession] = useState<any>(null);
  const [qrCodes, setQrCodes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefetching, startRefetchTransition] = useTransition();
  const [isBulkDeleting, startBulkDelete] = useTransition();

  // Filter/search/sort state
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [dynamicFilter, setDynamicFilter] = useState<DynamicFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('newest');

  // Selection + pagination
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{
    dataString: string;
    config: any;
    logoDataUri?: string;
  } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const sessionData = await getSession();
      if (sessionData?.user) {
        const plainSession = JSON.parse(JSON.stringify(sessionData));
        setSession(plainSession);
        const codes = await getQrCodes();
        setQrCodes(codes);
      }
      setIsLoading(false);
    };
    fetchData();
  }, []);

  const fetchQrCodes = useCallback(() => {
    startRefetchTransition(async () => {
      const codes = await getQrCodes();
      setQrCodes(codes);
      setSelectedIds(new Set());
    });
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = qrCodes.filter((code: any) => {
      if (q && !(code.name || '').toLowerCase().includes(q)) return false;
      if (typeFilter !== 'all' && code.dataType !== typeFilter) return false;
      if (dynamicFilter === 'dynamic' && !code.shortUrl) return false;
      if (dynamicFilter === 'static' && code.shortUrl) return false;
      return true;
    });
    list = [...list].sort((a: any, b: any) => {
      switch (sortKey) {
        case 'oldest':
          return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
        case 'name-asc':
          return (a.name || '').localeCompare(b.name || '');
        case 'name-desc':
          return (b.name || '').localeCompare(a.name || '');
        case 'newest':
        default:
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
    });
    return list;
  }, [qrCodes, search, typeFilter, dynamicFilter, sortKey]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageSlice = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  useEffect(() => {
    setPage(1);
  }, [search, typeFilter, dynamicFilter, sortKey, pageSize]);

  const stats = useMemo(() => {
    const total = qrCodes.length;
    const dynamic = qrCodes.filter((q: any) => !!q.shortUrl).length;
    const staticCount = total - dynamic;
    const now = Date.now();
    const last7 = qrCodes.filter(
      (q: any) => q.createdAt && now - new Date(q.createdAt).getTime() <= 7 * 24 * 60 * 60 * 1000,
    ).length;
    return { total, dynamic, staticCount, last7 };
  }, [qrCodes]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };
  const allPageSelected =
    pageSlice.length > 0 && pageSlice.every((c: any) => selectedIds.has(c._id.toString()));
  const toggleSelectPage = () => {
    const next = new Set(selectedIds);
    if (allPageSelected) pageSlice.forEach((c: any) => next.delete(c._id.toString()));
    else pageSlice.forEach((c: any) => next.add(c._id.toString()));
    setSelectedIds(next);
  };

  const handleBulkDelete = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    startBulkDelete(async () => {
      const result = await deleteManyQrCodes(ids);
      if (result.success) {
        toast({ title: 'Deleted', description: `${result.deleted ?? ids.length} QR codes removed.` });
        fetchQrCodes();
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    });
  };

  const handleDeleteOne = async (id: string) => {
    const result = await deleteQrCode(id);
    if (result.success) {
      toast({ title: 'Success', description: 'QR Code deleted.' });
      fetchQrCodes();
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const handleExport = () => {
    const rows: string[][] = [
      ['Name', 'Type', 'Dynamic', 'Data / Short URL', 'Created At'],
    ];
    for (const code of filtered) {
      const isDynamic = !!code.shortUrl;
      const dataStr = generateDataString(code);
      rows.push([
        code.name || '',
        code.dataType || '',
        isDynamic ? 'yes' : 'no',
        dataStr,
        code.createdAt ? new Date(code.createdAt).toISOString() : '',
      ]);
    }
    downloadCsv(`qr-codes-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  const handleCopy = (id: string, value: string) => {
    if (!value) return;
    copy(value);
    setCopiedId(id);
    setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
  };

  const handleView = (code: any) => {
    setPreviewData({
      dataString: generateDataString(code),
      config: code.config,
      logoDataUri: code.logoDataUri,
    });
  };

  const breadcrumbs = (
    <ZoruBreadcrumb>
      <ZoruBreadcrumbList>
        <ZoruBreadcrumbItem>
          <ZoruBreadcrumbLink href="/dashboard">Home</ZoruBreadcrumbLink>
        </ZoruBreadcrumbItem>
        <ZoruBreadcrumbSeparator />
        <ZoruBreadcrumbItem>
          <ZoruBreadcrumbPage>QR Code Maker</ZoruBreadcrumbPage>
        </ZoruBreadcrumbItem>
      </ZoruBreadcrumbList>
    </ZoruBreadcrumb>
  );

  if (isLoading) {
    return (
      <div className="flex min-h-full flex-col gap-6">
        {breadcrumbs}
        <ZoruSkeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <ZoruSkeleton key={i} className="h-[88px] rounded-xl" />
          ))}
        </div>
        <ZoruSkeleton className="h-[420px] w-full rounded-xl" />
        <ZoruSkeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="flex min-h-full flex-col gap-6">
        {breadcrumbs}
        <ZoruCard className="p-10 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-zoru-ink-muted/40 mb-4" />
          <h3 className="text-sm text-zoru-ink mb-1">Authentication required</h3>
          <p className="text-xs text-zoru-ink-muted">You must be logged in to access this page.</p>
        </ZoruCard>
      </div>
    );
  }

  return (
    <>
      <QrCodeDialog
        dataString={previewData?.dataString || null}
        config={previewData?.config}
        logoDataUri={previewData?.logoDataUri}
        open={!!previewData}
        onOpenChange={(open) => !open && setPreviewData(null)}
      />
      <div className="flex min-h-full flex-col gap-6">
        {breadcrumbs}

        <div className="flex flex-wrap items-start justify-between gap-4">
          <ZoruPageHeader>
            <ZoruPageHeading>
              <ZoruPageTitle>
                <span className="inline-flex items-center gap-3">
                  <QrCode className="h-7 w-7" />
                  QR Code Maker
                </span>
              </ZoruPageTitle>
              <ZoruPageDescription>
                Generate customizable QR codes for links, text, WhatsApp messages, and more.
              </ZoruPageDescription>
            </ZoruPageHeading>
          </ZoruPageHeader>
          <div className="flex flex-wrap items-center gap-2">
            <ZoruButton
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={filtered.length === 0}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </ZoruButton>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total QR Codes" value={stats.total} />
          <StatCard label="Dynamic" value={stats.dynamic} hint="Editable short-URL backed" />
          <StatCard label="Static" value={stats.staticCount} />
          <StatCard label="Last 7 days" value={stats.last7} />
        </div>

        {/* Generator */}
        <ZoruCard className="p-0 overflow-hidden">
          <QrCodeGenerator user={session.user} />
        </ZoruCard>

        {/* Saved QR Codes */}
        <ZoruCard className="p-0">
          <div className="flex items-center justify-between border-b border-zoru-line px-5 py-4">
            <h2 className="text-[15px] text-zoru-ink">Your Saved QR Codes</h2>
            <div className="text-[11.5px] text-zoru-ink-muted">
              {filtered.length} of {qrCodes.length}
            </div>
          </div>

          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3 border-b border-zoru-line px-5 py-3.5">
            <div className="flex-1 min-w-[220px]">
              <ZoruInput
                placeholder="Search by name..."
                leadingSlot={<Search />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="min-w-[140px]">
              <ZoruSelect value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
                <ZoruSelectTrigger>
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {typeOptions.map((o) => (
                    <ZoruSelectItem key={o.value} value={o.value}>
                      {o.label}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </ZoruSelect>
            </div>
            <div className="min-w-[140px]">
              <ZoruSelect
                value={dynamicFilter}
                onValueChange={(v) => setDynamicFilter(v as DynamicFilter)}
              >
                <ZoruSelectTrigger>
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {dynamicOptions.map((o) => (
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
          </div>

          {selectedIds.size > 0 ? (
            <div className="flex flex-wrap items-center gap-3 border-b border-zoru-line bg-zoru-surface-2 px-5 py-2.5 text-[12.5px]">
              <span className="text-zoru-ink">
                <strong>{selectedIds.size}</strong> selected
              </span>
              <div className="flex items-center gap-2">
                <ZoruButton variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
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
                      <ZoruAlertDialogTitle>Delete {selectedIds.size} QR code(s)?</ZoruAlertDialogTitle>
                      <ZoruAlertDialogDescription>
                        This permanently removes the selected QR codes and any associated short links. This
                        action cannot be undone.
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
                      aria-label="Select all on page"
                      className="h-3.5 w-3.5 rounded border-zoru-line"
                    />
                  </th>
                  <th className="px-2 py-3">Name</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Data / Link</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isRefetching && pageSlice.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-4">
                      <ZoruSkeleton className="h-10 w-full" />
                    </td>
                  </tr>
                ) : pageSlice.length > 0 ? (
                  pageSlice.map((code: any) => {
                    const id = code._id.toString();
                    const isDynamic = !!code.shortUrl;
                    const selected = selectedIds.has(id);
                    const isNew =
                      code.createdAt && Date.now() - new Date(code.createdAt).getTime() <= RECENT_MS;
                    const shortUrlStr = isDynamic
                      ? `${typeof window !== 'undefined' ? window.location.origin : ''}/s/${code.shortUrl.shortCode}`
                      : '';
                    const staticPreview = generateDataString(code);
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
                            aria-label="Select QR code"
                            className="h-3.5 w-3.5 rounded border-zoru-line"
                          />
                        </td>
                        <td className="px-2 py-3">
                          <div className="flex items-center gap-2 text-zoru-ink">
                            {code.name || '(untitled)'}
                            {isNew ? (
                              <span className="rounded-full border border-zoru-success/40 bg-zoru-success/10 px-1.5 py-0 text-[10px] text-zoru-success-ink">
                                New
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="rounded-full border border-zoru-line bg-zoru-surface-2 px-1.5 py-0.5 text-[10.5px] capitalize text-zoru-ink">
                              {code.dataType}
                            </span>
                            {isDynamic ? (
                              <span className="rounded-full border border-zoru-line bg-zoru-surface-2 px-1.5 py-0.5 text-[10.5px] text-zoru-ink">
                                Dynamic
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-5 py-3 font-mono text-[11.5px] text-zoru-ink-muted max-w-[260px]">
                          {isDynamic ? (
                            <div className="flex items-center gap-1.5">
                              <Link
                                href={`/dashboard/url-shortener/${code.shortUrl._id}`}
                                className="truncate text-zoru-ink hover:underline"
                              >
                                {shortUrlStr.replace(/^https?:\/\//, '')}
                              </Link>
                              <button
                                type="button"
                                onClick={() => handleCopy(id, shortUrlStr)}
                                className="rounded p-0.5 text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink"
                                aria-label="Copy short URL"
                              >
                                {copiedId === id ? (
                                  <Check className="h-3 w-3 text-zoru-success-ink" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="truncate">{staticPreview}</span>
                              {staticPreview ? (
                                <button
                                  type="button"
                                  onClick={() => handleCopy(id, staticPreview)}
                                  className="rounded p-0.5 text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink"
                                  aria-label="Copy data"
                                >
                                  {copiedId === id ? (
                                    <Check className="h-3 w-3 text-zoru-success-ink" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </button>
                              ) : null}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3 text-zoru-ink">
                          {code.createdAt ? new Date(code.createdAt).toLocaleDateString() : '—'}
                        </td>
                        <td className="min-w-[92px] px-5 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleView(code)}
                              className="rounded p-1.5 text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink"
                              aria-label="View QR"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
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
                                  <ZoruAlertDialogTitle>Delete "{code.name}"?</ZoruAlertDialogTitle>
                                  <ZoruAlertDialogDescription>
                                    This permanently removes the QR code. This action cannot be undone.
                                  </ZoruAlertDialogDescription>
                                </ZoruAlertDialogHeader>
                                <ZoruAlertDialogFooter>
                                  <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                                  <ZoruAlertDialogAction onClick={() => handleDeleteOne(id)}>Delete</ZoruAlertDialogAction>
                                </ZoruAlertDialogFooter>
                              </ZoruAlertDialogContent>
                            </ZoruAlertDialog>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-zoru-ink-muted">
                      {qrCodes.length === 0
                        ? 'No QR codes saved yet. Use the generator above to create one.'
                        : 'No QR codes match your filters.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filtered.length > 0 ? (
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
                  {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}
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
