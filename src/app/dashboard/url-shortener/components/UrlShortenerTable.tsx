import { useTransition } from 'react';
import Link from 'next/link';
import {
  Card,
  Button,
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
  Skeleton,
  cn,
  useZoruToast,
} from '@/components/zoruui';
import {
  Trash2,
  Check,
  Copy,
  Activity,
  BarChart,
  QrCode,
  MessageSquare,
  LoaderCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { deleteManyShortUrls, deleteShortUrl } from '@/app/actions/url-shortener.actions';
import type { WithId, ShortUrl } from '@/lib/definitions';

const PAGE_SIZES = [10, 25, 50, 100];

function DeleteButton({ urlId, onDeleted }: { urlId: string; onDeleted: () => void }) {
  const { toast } = useZoruToast();
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      try {
        const result = await deleteShortUrl(urlId);
        if (result.success) {
          toast({ title: 'Success', description: 'URL deleted.' });
          onDeleted();
        } else {
          toast({ title: 'Error', description: result.error || 'Failed to delete URL.', variant: 'destructive' });
        }
      } catch (err) {
        toast({ title: 'Error', description: 'Network error occurred.', variant: 'destructive' });
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

export function UrlShortenerTable({
  urls,
  filteredUrls,
  pageSlice,
  isLoading,
  selectedIds,
  setSelectedIds,
  allPageSelected,
  toggleSelectPage,
  toggleSelect,
  page,
  setPage,
  pageSize,
  setPageSize,
  pageCount,
  currentPage,
  getShortUrl,
  getStatus,
  copiedId,
  handleCopy,
  setSelectedUrlForQr,
  setNotesPanel,
  fetchUrls,
}: {
  urls: WithId<ShortUrl>[];
  filteredUrls: WithId<ShortUrl>[];
  pageSlice: WithId<ShortUrl>[];
  isLoading: boolean;
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
  allPageSelected: boolean;
  toggleSelectPage: () => void;
  toggleSelect: (id: string) => void;
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  pageSize: number;
  setPageSize: (size: number) => void;
  pageCount: number;
  currentPage: number;
  getShortUrl: (url: WithId<ShortUrl>) => string;
  getStatus: (url: WithId<ShortUrl>) => 'active' | 'expired' | 'expiring-soon';
  copiedId: string | null;
  handleCopy: (id: string, value: string) => void;
  setSelectedUrlForQr: (val: string) => void;
  setNotesPanel: (val: { id: string }) => void;
  fetchUrls: () => void;
}) {
  const { toast } = useZoruToast();
  const [isBulkDeleting, startBulkDelete] = useTransition();

  const handleBulkDelete = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    startBulkDelete(async () => {
      try {
        const result = await deleteManyShortUrls(ids);
        if (result.success) {
          toast({ title: 'Deleted', description: `${result.deleted ?? ids.length} links removed.` });
          fetchUrls();
        } else {
          toast({ title: 'Error', description: result.error || 'Failed to delete URLs.', variant: 'destructive' });
        }
      } catch (err) {
        toast({ title: 'Error', description: 'Network error occurred.', variant: 'destructive' });
      }
    });
  };

  return (
    <Card className="p-0">
      {selectedIds.size > 0 ? (
        <div className="flex items-center justify-between gap-3 border-b border-zoru-line bg-zoru-surface-2 px-5 py-2.5 text-[12.5px]">
          <span className="text-zoru-ink">
            <strong>{selectedIds.size}</strong> selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
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
                  aria-label="Select all on page"
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
                      'border-b border-zoru-line last:border-0 hover:bg-zoru-surface-2',
                      selected && 'bg-zoru-surface-2',
                    )}
                  >
                    <td className="w-10 px-5 py-3">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSelect(id)}
                        aria-label="Select link"
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
    </Card>
  );
}
