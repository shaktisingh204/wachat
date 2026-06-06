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
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Skeleton,
  cn,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition } from 'react';
import {
  AlertCircle,
  BarChart2,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  LoaderCircle,
  MessageSquare,
  QrCode,
  Trash2,
  Upload,
  } from 'lucide-react';
import { QrCodeSidebar } from '@/components/zoruui-domain/qr-code-sidebar';
import Link from 'next/link';
import { getSession } from '@/app/actions/index';
import { deleteManyQrCodes,
  deleteQrCode,
  getQrCodes } from '@/app/actions/qr-code.actions';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { QrCodeGenerator } from '@/components/zoruui-domain/qr-code-generator';
import { QrCodeDialog } from '@/components/zoruui-domain/qr-code-dialog';
import { CommentsNotesPanel } from '@/components/zoruui-domain/comments-notes-panel';
import { EditQrDialog } from '@/components/zoruui-domain/edit-qr-dialog';
import { SharePermissionsModal } from '@/components/zoruui-domain/share-permissions-modal';
import { QrScanStatsModal } from '@/components/zoruui-domain/qr-scan-stats-modal';
import { BulkQrImportDialog } from '@/components/zoruui-domain/bulk-qr-import-dialog';
import { normalizeQrWebsiteUrl } from '@/lib/qr-utils';

type SortKey = 'newest' | 'oldest' | 'name-asc' | 'name-desc';
type DynamicFilter = 'all' | 'dynamic' | 'static';
type TypeFilter = 'all' | 'url' | 'text' | 'email' | 'phone' | 'sms' | 'wifi';

const PAGE_SIZES = [10, 25, 50];
const RECENT_MS = 24 * 60 * 60 * 1000;

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
    <Card className="p-4">
      <div className="text-[11px] uppercase tracking-wider text-[var(--st-text-secondary)]">{label}</div>
      <div className="mt-1.5 text-[22px] text-[var(--st-text)] leading-tight">{value}</div>
      {hint ? <div className="mt-0.5 text-[11px] text-[var(--st-text-secondary)]">{hint}</div> : null}
    </Card>
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
  const [notesPanel, setNotesPanel] = useState<{ id: string } | null>(null);
  const [scanStatsModal, setScanStatsModal] = useState<{ id: string; name: string; isDynamic: boolean } | null>(null);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);

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
    const totalScans = qrCodes.reduce(
      (sum: number, q: any) => sum + (q.shortUrl?.clickCount || 0),
      0,
    );
    return { total, dynamic, staticCount, last7, totalScans };
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
    <Breadcrumb>
      <ZoruBreadcrumbList>
        <ZoruBreadcrumbItem>
          <ZoruBreadcrumbLink href="/dashboard">Home</ZoruBreadcrumbLink>
        </ZoruBreadcrumbItem>
        <ZoruBreadcrumbSeparator />
        <ZoruBreadcrumbItem>
          <ZoruBreadcrumbPage>QR Code Maker</ZoruBreadcrumbPage>
        </ZoruBreadcrumbItem>
      </ZoruBreadcrumbList>
    </Breadcrumb>
  );

  if (isLoading) {
    return (
      <div className="flex min-h-full flex-col gap-6">
        {breadcrumbs}
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[88px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[420px] w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="flex min-h-full flex-col gap-6">
        {breadcrumbs}
        <Card className="p-10 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-[var(--st-text-secondary)]/40 mb-4" />
          <h3 className="text-sm text-[var(--st-text)] mb-1">Authentication required</h3>
          <p className="text-xs text-[var(--st-text-secondary)]">You must be logged in to access this page.</p>
        </Card>
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
      {notesPanel ? (
        <CommentsNotesPanel
          entityId={notesPanel.id}
          entityType="qr"
          open={!!notesPanel}
          onOpenChange={(v) => { if (!v) setNotesPanel(null); }}
        />
      ) : null}
      {/* Bulk import dialog */}
      <BulkQrImportDialog
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        onComplete={() => { setBulkImportOpen(false); fetchQrCodes(); }}
      />
      {/* Scan stats modal */}
      {scanStatsModal && (
        <QrScanStatsModal
          qrCodeId={scanStatsModal.id}
          qrName={scanStatsModal.name}
          isDynamic={scanStatsModal.isDynamic}
          open={!!scanStatsModal}
          onOpenChange={(v) => { if (!v) setScanStatsModal(null); }}
        />
      )}
      <div className="flex min-h-full flex-col gap-6">
        {breadcrumbs}

        <div className="flex flex-wrap items-start justify-between gap-4">
          <PageHeader>
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
          </PageHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={filtered.length === 0}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkImportOpen(true)}
            >
              <Upload className="h-3.5 w-3.5" />
              Bulk Import
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total QR Codes" value={stats.total} />
          <StatCard label="Dynamic" value={stats.dynamic} hint="Editable short-URL backed" />
          <StatCard label="Total Scans" value={stats.totalScans.toLocaleString()} hint="Dynamic QR only" />
          <StatCard label="Last 7 days" value={stats.last7} />
        </div>

        {/* Generator */}
        <Card className="p-0 overflow-hidden">
          <QrCodeGenerator user={session.user} />
        </Card>

        {/* Saved QR Codes — sidebar + table */}
        <div className="flex flex-col lg:flex-row gap-4">
          <QrCodeSidebar
            search={search}
            onSearchChange={setSearch}
            typeFilter={typeFilter}
            onTypeChange={setTypeFilter}
            dynamicFilter={dynamicFilter}
            onDynamicChange={setDynamicFilter}
            sortKey={sortKey}
            onSortChange={setSortKey}
          />
          <div className="flex-1 min-w-0">
        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-[var(--st-border)] px-5 py-4">
            <h2 className="text-[15px] text-[var(--st-text)]">Your Saved QR Codes</h2>
            <div className="text-[11.5px] text-[var(--st-text-secondary)]">
              {filtered.length} of {qrCodes.length}
            </div>
          </div>

          {selectedIds.size > 0 ? (
            <div className="flex flex-wrap items-center gap-3 border-b border-[var(--st-border)] bg-[var(--st-bg-muted)] px-5 py-2.5 text-[12.5px]">
              <span className="text-[var(--st-text)]">
                <strong>{selectedIds.size}</strong> selected
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                  Clear
                </Button>
                <ZoruAlertDialog>
                  <ZoruAlertDialogTrigger asChild>
                    <Button size="sm" disabled={isBulkDeleting}>
                      {isBulkDeleting ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Delete selected
                    </Button>
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
                <tr className="border-b border-[var(--st-border)] text-left text-[12px] text-[var(--st-text-secondary)]">
                  <th className="w-10 px-5 py-3">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={toggleSelectPage}
                      aria-label="Select all on page"
                      className="h-3.5 w-3.5 rounded border-[var(--st-border)]"
                    />
                  </th>
                  <th className="px-2 py-3">Name</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Data / Link</th>
                  <th className="px-5 py-3">Scans</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isRefetching && pageSlice.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-4">
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
                          'border-b border-[var(--st-border)] last:border-0 hover:bg-[var(--st-bg-muted)]',
                          selected && 'bg-[var(--st-bg-muted)]',
                        )}
                      >
                        <td className="w-10 px-5 py-3">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleSelect(id)}
                            aria-label="Select QR code"
                            className="h-3.5 w-3.5 rounded border-[var(--st-border)]"
                          />
                        </td>
                        <td className="px-2 py-3">
                          <div className="flex items-center gap-2 text-[var(--st-text)]">
                            {code.name || '(untitled)'}
                            {isNew ? (
                              <span className="rounded-full border border-[var(--st-status-ok)]/40 bg-[var(--st-status-ok)]/10 px-1.5 py-0 text-[10px] text-[var(--st-status-ok)]">
                                New
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="rounded-full border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-1.5 py-0.5 text-[10.5px] capitalize text-[var(--st-text)]">
                              {code.dataType}
                            </span>
                            {isDynamic ? (
                              <span className="rounded-full border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-1.5 py-0.5 text-[10.5px] text-[var(--st-text)]">
                                Dynamic
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-5 py-3 font-mono text-[11.5px] text-[var(--st-text-secondary)] max-w-[260px]">
                          {isDynamic ? (
                            <div className="flex items-center gap-1.5">
                              <Link
                                href={`/dashboard/url-shortener/${code.shortUrl._id}`}
                                className="truncate text-[var(--st-text)] hover:underline"
                              >
                                {shortUrlStr.replace(/^https?:\/\//, '')}
                              </Link>
                              <button
                                type="button"
                                onClick={() => handleCopy(id, shortUrlStr)}
                                className="rounded p-0.5 text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)]"
                                aria-label="Copy short URL"
                              >
                                {copiedId === id ? (
                                  <Check className="h-3 w-3 text-[var(--st-status-ok)]" />
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
                                  className="rounded p-0.5 text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)]"
                                  aria-label="Copy data"
                                >
                                  {copiedId === id ? (
                                    <Check className="h-3 w-3 text-[var(--st-status-ok)]" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </button>
                              ) : null}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3 text-[var(--st-text)]">
                          {isDynamic ? (
                            <span className="text-[13px]">
                              {(code.shortUrl?.clickCount || 0).toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-[11px] text-[var(--st-text-secondary)]/50">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-[var(--st-text)]">
                          {code.createdAt ? new Date(code.createdAt).toLocaleDateString() : '—'}
                        </td>
                        <td className="min-w-[108px] px-5 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleView(code)}
                              className="rounded p-1.5 text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)]"
                              aria-label="View QR"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setNotesPanel({ id })}
                              className="rounded p-1.5 text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)]"
                              aria-label="Notes & Comments"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                            </button>
                            {/* Edit button */}
                            <EditQrDialog
                              qrCode={code}
                              onComplete={fetchQrCodes}
                            />
                            <SharePermissionsModal
                              resourceType="qr"
                              resourceId={code._id?.toString?.() ?? String(code._id)}
                              resourceName={code.name}
                            />
                            {/* Scan stats button (only for dynamic QR codes) */}
                            {code.shortUrl && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                title="View Scan Stats"
                                onClick={() => setScanStatsModal({
                                  id,
                                  name: code.name,
                                  isDynamic: true,
                                })}
                              >
                                <BarChart2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <ZoruAlertDialog>
                              <ZoruAlertDialogTrigger asChild>
                                <button
                                  type="button"
                                  className="rounded p-1.5 text-[var(--st-text-secondary)] hover:bg-[var(--st-danger)]/10 hover:text-[var(--st-danger)]"
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
                    <td colSpan={7} className="px-5 py-12 text-center text-[var(--st-text-secondary)]">
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
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--st-border)] px-5 py-3 text-[12px] text-[var(--st-text-secondary)]">
              <div className="flex items-center gap-2">
                <span>Rows per page</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="h-7 rounded border border-[var(--st-border)] bg-[var(--st-bg)] px-2 text-[12px] text-[var(--st-text)]"
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
                    className="rounded p-1 text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)] disabled:opacity-40 disabled:pointer-events-none"
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
                    className="rounded p-1 text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)] disabled:opacity-40 disabled:pointer-events-none"
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </Card>
          </div>
        </div>
      </div>
    </>
  );
}
