'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Copy,
  FileText,
  IndianRupee,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  Trash2,
} from 'lucide-react';

import {
  Button,
  Card,
  CardBody,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  SegmentedControl,
  StatCard,
  Table,
  TBody,
  Td,
  Th,
  THead,
  toast,
  Tr,
} from '@/components/sabcrm/20ui';
import {
  formatSabpayAmount,
  type SabpayMode,
  type SabpayPaymentPage,
} from '@/lib/sabpay/types';

import { ConfirmAction } from '../_components/confirm-action';
import { CopyableId } from '../_components/copyable-id';
import { EntityStatusBadge } from '../_components/entity-status-badge';
import { ListToolbar } from '../_components/list-toolbar';
import { LoadMore } from '../_components/load-more';
import {
  deleteSabpayPaymentPage,
  getSabpayPaymentPages,
  updateSabpayPaymentPage,
} from '../actions/payment-pages';

type StatusFilter = 'all' | 'active' | 'deactivated';

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'deactivated', label: 'Deactivated' },
];

const SR_ONLY: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

function amountTypeLabel(page: SabpayPaymentPage): string {
  if (page.amountType === 'fixed') {
    return page.amount != null
      ? `Fixed · ${formatSabpayAmount(page.amount)}`
      : 'Fixed';
  }
  return page.minAmount != null
    ? `Customer decides · min ${formatSabpayAmount(page.minAmount)}`
    : 'Customer decides';
}

export function PaymentPagesClient({
  initialPages,
  mode,
  pageSize,
}: {
  initialPages: SabpayPaymentPage[];
  mode: SabpayMode;
  pageSize: number;
}) {
  const router = useRouter();
  const [filter, setFilter] = React.useState<StatusFilter>('all');
  // Older pages fetched through "Load more" — merged after the (refreshable)
  // server-provided first page, deduped by id so router.refresh() never
  // duplicates rows.
  const [loaded, setLoaded] = React.useState<SabpayPaymentPage[]>([]);
  const [hasMore, setHasMore] = React.useState(initialPages.length === pageSize);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<SabpayPaymentPage | null>(null);

  const pages = React.useMemo(() => {
    const seen = new Map<string, SabpayPaymentPage>();
    for (const p of [...initialPages, ...loaded]) {
      if (!seen.has(p.id)) seen.set(p.id, p);
    }
    return Array.from(seen.values());
  }, [initialPages, loaded]);

  const visible =
    filter === 'all'
      ? pages
      : pages.filter((p) => (filter === 'active' ? p.active : !p.active));

  const stats = React.useMemo(() => {
    let activeCount = 0;
    let fixedCount = 0;
    for (const p of pages) {
      if (p.active) activeCount += 1;
      if (p.amountType === 'fixed') fixedCount += 1;
    }
    return { total: pages.length, active: activeCount, fixed: fixedCount };
  }, [pages]);

  const createButton = (
    <Button variant="primary" asChild>
      <Link href="/sabpay/payment-pages/new">
        <Plus size={15} aria-hidden="true" />
        Create payment page
      </Link>
    </Button>
  );

  async function loadMore() {
    const oldest = pages[pages.length - 1];
    if (!oldest) return;
    setLoadingMore(true);
    try {
      const batch = await getSabpayPaymentPages({
        limit: pageSize,
        before: oldest.createdAt,
      });
      setLoaded((prev) => [...prev, ...batch]);
      setHasMore(batch.length === pageSize);
    } catch {
      toast({ title: 'Could not load more pages', tone: 'danger' });
    } finally {
      setLoadingMore(false);
    }
  }

  async function copyUrl(page: SabpayPaymentPage) {
    try {
      await navigator.clipboard.writeText(page.url);
      toast({ title: 'Page URL copied', tone: 'success' });
    } catch {
      toast({ title: 'Could not copy', description: page.url });
    }
  }

  async function toggleActive(page: SabpayPaymentPage) {
    setTogglingId(page.id);
    const result = await updateSabpayPaymentPage(page.id, { active: !page.active });
    setTogglingId(null);
    if (result.error || !result.page) {
      toast({
        title: 'Could not update the page',
        description: result.error,
        tone: 'danger',
      });
      return;
    }
    const updated = result.page;
    setLoaded((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    toast({
      title: updated.active ? 'Page activated' : 'Page deactivated',
      description: updated.active
        ? 'The page is live at its URL again.'
        : 'Visitors now see this page as unavailable.',
      tone: 'success',
    });
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const result = await deleteSabpayPaymentPage(deleteTarget.id);
    if (result.error || !result.ok) {
      toast({
        title: 'Could not delete the page',
        description: result.error,
        tone: 'danger',
      });
      throw new Error(result.error || 'Delete failed');
    }
    const deletedId = deleteTarget.id;
    setLoaded((prev) => prev.filter((p) => p.id !== deletedId));
    toast({ title: 'Payment page deleted', tone: 'success' });
    router.refresh();
  }

  return (
    <>
      <ListToolbar
        left={
          <SegmentedControl
            aria-label="Filter payment pages by status"
            items={FILTERS}
            value={filter}
            onChange={setFilter}
          />
        }
        actions={createButton}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--st-space-4, 16px)',
        }}
      >
        <StatCard label="Total pages" value={stats.total} icon={FileText} />
        <StatCard label="Active" value={stats.active} icon={CheckCircle2} />
        <StatCard label="Fixed-amount" value={stats.fixed} icon={IndianRupee} />
      </div>

      <Card>
        <CardBody>
          {visible.length === 0 ? (
            <EmptyState
              icon={<FileText size={22} />}
              title={
                filter === 'all'
                  ? `No payment pages in ${mode} mode yet`
                  : `No ${filter} payment pages in ${mode} mode yet`
              }
              description="A payment page is a hosted, no-code page you can publish at its own URL to collect payments — create your first one to share it."
              action={createButton}
            />
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Title</Th>
                  <Th>Slug</Th>
                  <Th>Amount type</Th>
                  <Th>Status</Th>
                  <Th>Created</Th>
                  <Th>
                    <span style={SR_ONLY}>Actions</span>
                  </Th>
                </Tr>
              </THead>
              <TBody>
                {visible.map((p) => (
                  <Tr key={p.id}>
                    <Td>
                      <Link
                        href={`/sabpay/payment-pages/${p.id}`}
                        style={{ fontWeight: 600 }}
                      >
                        {p.title}
                      </Link>
                    </Td>
                    <Td style={{ maxWidth: 280 }}>
                      <CopyableId value={p.url} />
                    </Td>
                    <Td>{amountTypeLabel(p)}</Td>
                    <Td>
                      <EntityStatusBadge status={p.active ? 'active' : 'deactivated'} />
                    </Td>
                    <Td>{new Date(p.createdAt).toLocaleString()}</Td>
                    <Td style={{ textAlign: 'right' }}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Actions for ${p.title}`}
                            iconLeft={<MoreHorizontal size={15} />}
                          />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {/* Not `asChild` + <Link>: the item already renders an
                              icon child, and Radix Slot requires exactly one. */}
                          <DropdownMenuItem
                            iconLeft={Pencil}
                            onSelect={() => router.push(`/sabpay/payment-pages/${p.id}`)}
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            iconLeft={Copy}
                            onSelect={() => void copyUrl(p)}
                          >
                            Copy URL
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            iconLeft={Power}
                            disabled={togglingId === p.id}
                            onSelect={() => void toggleActive(p)}
                          >
                            {p.active ? 'Deactivate' : 'Activate'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            iconLeft={Trash2}
                            variant="danger"
                            onSelect={() => setDeleteTarget(p)}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <LoadMore hasMore={hasMore} loading={loadingMore} onClick={() => void loadMore()} />

      <ConfirmAction
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={deleteTarget ? `Delete “${deleteTarget.title}”?` : 'Delete payment page?'}
        description="The hosted page stops working immediately and its URL is freed up. Payments already collected through it are kept."
        confirmLabel="Delete page"
      />
    </>
  );
}
