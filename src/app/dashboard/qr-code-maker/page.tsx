'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { LuQrCode } from 'react-icons/lu';
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  LoaderCircle,
  Search,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { getSession } from '@/app/actions/index';
import { deleteManyQrCodes, deleteQrCode, getQrCodes } from '@/app/actions/qr-code.actions';
import { useToast } from '@/hooks/use-toast';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { QrCodeGenerator } from '@/components/wabasimplify/qr-code-generator';
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
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ClayBreadcrumbs, ClayButton, ClayCard, ClayInput, ClaySelect } from '@/components/clay';

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
    <ClayCard className="p-4">
      <div className="text-[11px] font-medium uppercase tracking-wider text-clay-ink-muted">{label}</div>
      <div className="mt-1.5 text-[22px] font-semibold text-clay-ink leading-tight">{value}</div>
      {hint ? <div className="mt-0.5 text-[11px] text-clay-ink-muted">{hint}</div> : null}
    </ClayCard>
  );
}

function generateDataString(code: any): string {
  if (code.dataType === 'url' && code.shortUrl) {
    const domain = typeof window !== 'undefined' ? window.location.origin : '';
    return `${domain}/s/${code.shortUrl.shortCode}`;
  }
  switch (code.dataType) {
    case 'url':
      return code.data?.url || '';
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
  const { toast } = useToast();
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
    <ClayBreadcrumbs
      items={[
        { label: 'Home', href: '/home' },
        { label: 'QR Code Maker' },
      ]}
    />
  );

  if (isLoading) {
    return (
      <div className="clay-enter flex min-h-full flex-col gap-6">
        {breadcrumbs}
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[88px] rounded-clay-lg" />
          ))}
        </div>
        <Skeleton className="h-[420px] w-full rounded-clay-lg" />
        <Skeleton className="h-64 w-full rounded-clay-lg" />
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="clay-enter flex min-h-full flex-col gap-6">
        {breadcrumbs}
        <ClayCard className="p-10 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-clay-ink-muted/30 mb-4" />
          <h3 className="text-sm font-medium text-clay-ink mb-1">Authentication required</h3>
          <p className="text-xs text-clay-ink-muted">You must be logged in to access this page.</p>
        </ClayCard>
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
      <div className="clay-enter flex min-h-full flex-col gap-6">
        {breadcrumbs}

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1] flex items-center gap-3">
              <LuQrCode className="h-7 w-7" />
              QR Code Maker
            </h1>
            <p className="mt-1.5 max-w-[720px] text-[13px] text-clay-ink-muted">
              Generate customizable QR codes for links, text, WhatsApp messages, and more.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ClayButton
              variant="pill"
              size="sm"
              onClick={handleExport}
              disabled={filtered.length === 0}
              leading={<Download className="h-3.5 w-3.5" />}
            >
              Export CSV
            </ClayButton>
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
        <ClayCard padded={false} className="overflow-hidden">
          <QrCodeGenerator user={session.user} />
        </ClayCard>

        {/* Saved QR Codes */}
        <ClayCard padded={false}>
          <div className="flex items-center justify-between border-b border-clay-border px-5 py-4">
            <h2 className="text-[15px] font-semibold text-clay-ink">Your Saved QR Codes</h2>
            <div className="text-[11.5px] text-clay-ink-muted">
              {filtered.length} of {qrCodes.length}
            </div>
          </div>

          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3 border-b border-clay-border px-5 py-3.5">
            <div className="flex-1 min-w-[220px]">
              <ClayInput
                sizeVariant="sm"
                placeholder="Search by name..."
                leading={<Search className="h-3.5 w-3.5" />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="min-w-[140px]">
              <ClaySelect
                sizeVariant="sm"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
                options={typeOptions}
              />
            </div>
            <div className="min-w-[140px]">
              <ClaySelect
                sizeVariant="sm"
                value={dynamicFilter}
                onChange={(e) => setDynamicFilter(e.target.value as DynamicFilter)}
                options={dynamicOptions}
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
          </div>

          {selectedIds.size > 0 ? (
            <div className="flex items-center justify-between gap-3 border-b border-clay-border bg-clay-rose-soft/40 px-5 py-2.5 text-[12.5px]">
              <span className="text-clay-ink">
                <strong>{selectedIds.size}</strong> selected
              </span>
              <div className="flex items-center gap-2">
                <ClayButton variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
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
                      <AlertDialogTitle>Delete {selectedIds.size} QR code(s)?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This permanently removes the selected QR codes and any associated short links. This
                        action cannot be undone.
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
                  <th className="px-2 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Data / Link</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isRefetching && pageSlice.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-4">
                      <Skeleton className="h-10 w-full" />
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
                          'border-b border-clay-border last:border-0 hover:bg-clay-surface-2',
                          selected && 'bg-clay-rose-soft/30',
                        )}
                      >
                        <td className="w-10 px-5 py-3">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleSelect(id)}
                            aria-label="Select QR code"
                            className="h-3.5 w-3.5 rounded border-clay-border"
                          />
                        </td>
                        <td className="px-2 py-3">
                          <div className="flex items-center gap-2 font-medium text-clay-ink">
                            {code.name || '(untitled)'}
                            {isNew ? (
                              <span className="rounded-full border border-clay-green/40 bg-clay-green/10 px-1.5 py-0 text-[10px] font-medium text-clay-green">
                                New
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="rounded-full border border-clay-border bg-clay-surface-2 px-1.5 py-0.5 text-[10.5px] capitalize text-clay-ink">
                              {code.dataType}
                            </span>
                            {isDynamic ? (
                              <span className="rounded-full border border-clay-accent/40 bg-clay-accent/10 px-1.5 py-0.5 text-[10.5px] font-medium text-clay-accent">
                                Dynamic
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-5 py-3 font-mono text-[11.5px] text-clay-ink-muted max-w-[260px]">
                          {isDynamic ? (
                            <div className="flex items-center gap-1.5">
                              <Link
                                href={`/dashboard/url-shortener/${code.shortUrl._id}`}
                                className="truncate text-clay-accent hover:underline"
                              >
                                {shortUrlStr.replace(/^https?:\/\//, '')}
                              </Link>
                              <button
                                type="button"
                                onClick={() => handleCopy(id, shortUrlStr)}
                                className="rounded p-0.5 text-clay-ink-muted hover:bg-clay-bg-2 hover:text-clay-ink"
                                aria-label="Copy short URL"
                              >
                                {copiedId === id ? (
                                  <Check className="h-3 w-3 text-clay-green" />
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
                                  className="rounded p-0.5 text-clay-ink-muted hover:bg-clay-bg-2 hover:text-clay-ink"
                                  aria-label="Copy data"
                                >
                                  {copiedId === id ? (
                                    <Check className="h-3 w-3 text-clay-green" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </button>
                              ) : null}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3 text-clay-ink">
                          {code.createdAt ? new Date(code.createdAt).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleView(code)}
                              className="rounded p-1.5 text-clay-ink-muted hover:bg-clay-bg-2 hover:text-clay-ink"
                              aria-label="View QR"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
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
                                  <AlertDialogTitle>Delete "{code.name}"?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This permanently removes the QR code. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteOne(id)}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-clay-ink-muted">
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
                  {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}
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
