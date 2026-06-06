'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  Button,
  IconButton,
  Badge,
  Checkbox,
  EmptyState,
  Skeleton,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  useToast,
} from '@/components/sabcrm/20ui';
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
  Link2,
} from 'lucide-react';
import { deleteManyShortUrls, deleteShortUrl } from '@/app/actions/url-shortener.actions';
import type { WithId, ShortUrl } from '@/lib/definitions';

const PAGE_SIZES = [10, 25, 50, 100];

type LinkStatus = 'active' | 'expired' | 'expiring-soon';

const STATUS_TONE: Record<LinkStatus, 'success' | 'warning' | 'danger'> = {
  active: 'success',
  'expiring-soon': 'warning',
  expired: 'danger',
};

function statusLabel(status: LinkStatus): string {
  if (status === 'expiring-soon') return 'Expiring soon';
  return status[0].toUpperCase() + status.slice(1);
}

function DeleteButton({ urlId, onDeleted }: { urlId: string; onDeleted: () => void }) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      try {
        const result = await deleteShortUrl(urlId);
        if (result.success) {
          toast({ title: 'Success', description: 'URL deleted.', tone: 'success' });
          onDeleted();
        } else {
          toast({ title: 'Error', description: result.error || 'Failed to delete URL.', tone: 'danger' });
        }
      } catch {
        toast({ title: 'Error', description: 'Network error occurred.', tone: 'danger' });
      }
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <IconButton label="Delete" icon={Trash2} size="sm" variant="danger" />
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
            {isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />} Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
  getStatus: (url: WithId<ShortUrl>) => LinkStatus;
  copiedId: string | null;
  handleCopy: (id: string, value: string) => void;
  setSelectedUrlForQr: (val: string) => void;
  setNotesPanel: (val: { id: string }) => void;
  fetchUrls: () => void;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [isBulkDeleting, startBulkDelete] = useTransition();

  const handleBulkDelete = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    startBulkDelete(async () => {
      try {
        const result = await deleteManyShortUrls(ids);
        if (result.success) {
          toast({ title: 'Deleted', description: `${result.deleted ?? ids.length} links removed.`, tone: 'success' });
          fetchUrls();
        } else {
          toast({ title: 'Error', description: result.error || 'Failed to delete URLs.', tone: 'danger' });
        }
      } catch {
        toast({ title: 'Error', description: 'Network error occurred.', tone: 'danger' });
      }
    });
  };

  return (
    <Card padding="none">
      {selectedIds.size > 0 ? (
        <div className="flex items-center justify-between gap-3 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-5 py-2.5 text-[12.5px]">
          <span className="text-[var(--st-text)]">
            <strong>{selectedIds.size}</strong> selected
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
              Clear
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="danger"
                  size="sm"
                  iconLeft={Trash2}
                  loading={isBulkDeleting}
                  disabled={isBulkDeleting}
                >
                  Delete selected
                </Button>
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
        <Table>
          <THead>
            <Tr>
              <Th width={40} align="center">
                <Checkbox
                  checked={allPageSelected}
                  onChange={toggleSelectPage}
                  aria-label="Select all on page"
                />
              </Th>
              <Th>Short URL</Th>
              <Th>Destination</Th>
              <Th>Status</Th>
              <Th>Health</Th>
              <Th>Clicks</Th>
              <Th align="right">Actions</Th>
            </Tr>
          </THead>
          <TBody>
            {isLoading ? (
              <Tr>
                <Td colSpan={7}>
                  <Skeleton className="h-10 w-full" />
                </Td>
              </Tr>
            ) : pageSlice.length > 0 ? (
              pageSlice.map((url) => {
                const id = url._id.toString();
                const shortUrl = getShortUrl(url);
                const status = getStatus(url);
                const selected = selectedIds.has(id);
                return (
                  <Tr key={id} selected={selected}>
                    <Td align="center">
                      <Checkbox
                        checked={selected}
                        onChange={() => toggleSelect(id)}
                        aria-label="Select link"
                      />
                    </Td>
                    <Td className="font-mono">
                      <div className="flex items-center gap-1">
                        <a
                          href={shortUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--st-text)] hover:underline"
                        >
                          {shortUrl.replace(/^https?:\/\//, '')}
                        </a>
                        <IconButton
                          label="Copy link"
                          icon={copiedId === id ? Check : Copy}
                          size="sm"
                          onClick={() => handleCopy(id, shortUrl)}
                          className={copiedId === id ? 'text-[var(--st-status-ok)]' : undefined}
                        />
                      </div>
                    </Td>
                    <Td truncate className="max-w-[240px] text-[var(--st-text-secondary)]">
                      {url.originalUrl}
                    </Td>
                    <Td>
                      <Badge tone={STATUS_TONE[status]} dot>
                        {statusLabel(status)}
                      </Badge>
                      {url.expiresAt ? (
                        <div className="mt-0.5 text-[10.5px] text-[var(--st-text-secondary)]">
                          {new Date(url.expiresAt).toLocaleDateString()}
                        </div>
                      ) : null}
                    </Td>
                    <Td>
                      {url.healthStatus ? (
                        <Badge
                          tone={
                            url.healthStatus === 'ok'
                              ? 'success'
                              : url.healthStatus === 'dead'
                                ? 'danger'
                                : 'neutral'
                          }
                        >
                          <Activity className="h-2.5 w-2.5" aria-hidden="true" />
                          {url.healthStatus === 'ok' ? 'Up' : url.healthStatus === 'dead' ? 'Down' : 'Unknown'}
                        </Badge>
                      ) : (
                        <span className="text-[11px] text-[var(--st-text-tertiary)]">-</span>
                      )}
                    </Td>
                    <Td className="text-[var(--st-text)]">{url.clickCount || 0}</Td>
                    <Td align="right">
                      <div className="inline-flex items-center gap-1">
                        <IconButton
                          label="Analytics"
                          icon={BarChart}
                          size="sm"
                          onClick={() => router.push(`/dashboard/url-shortener/${id}`)}
                        />
                        <IconButton
                          label="QR Code"
                          icon={QrCode}
                          size="sm"
                          onClick={() => setSelectedUrlForQr(shortUrl)}
                        />
                        <IconButton
                          label="Notes and comments"
                          icon={MessageSquare}
                          size="sm"
                          onClick={() => setNotesPanel({ id })}
                        />
                        <DeleteButton urlId={id} onDeleted={fetchUrls} />
                      </div>
                    </Td>
                  </Tr>
                );
              })
            ) : (
              <Tr>
                <Td colSpan={7}>
                  <EmptyState
                    icon={Link2}
                    title={urls.length === 0 ? 'No links created yet' : 'No links match your filters'}
                    description={
                      urls.length === 0
                        ? 'Short links you create will appear here.'
                        : 'Try adjusting your search or filters to see more results.'
                    }
                  />
                </Td>
              </Tr>
            )}
          </TBody>
        </Table>
      </div>

      {/* Pagination */}
      {filteredUrls.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--st-border)] px-5 py-3 text-[12px] text-[var(--st-text-secondary)]">
          <div className="flex items-center gap-2">
            <span>Rows per page</span>
            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
              <SelectTrigger aria-label="Rows per page" className="h-7 w-[72px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span>
              {(currentPage - 1) * pageSize + 1}-
              {Math.min(currentPage * pageSize, filteredUrls.length)} of {filteredUrls.length}
            </span>
            <div className="flex items-center gap-1">
              <IconButton
                label="Previous page"
                icon={ChevronLeft}
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
              />
              <span className="min-w-[48px] text-center">
                {currentPage} / {pageCount}
              </span>
              <IconButton
                label="Next page"
                icon={ChevronRight}
                size="sm"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={currentPage >= pageCount}
              />
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
