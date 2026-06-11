'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Link2, MoreHorizontal, Plus, XCircle } from 'lucide-react';

import {
  Button,
  Card,
  CardBody,
  DatePicker,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Field,
  Input,
  Modal,
  SegmentedControl,
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
  type SabpayPaymentLink,
} from '@/lib/sabpay/types';

import {
  cancelSabpayPaymentLink,
  createSabpayPaymentLink,
  getSabpayPaymentLinks,
} from '../actions/payment-links';
import { ConfirmAction } from '../_components/confirm-action';
import { EntityStatusBadge } from '../_components/entity-status-badge';
import { ListToolbar } from '../_components/list-toolbar';
import { LoadMore } from '../_components/load-more';

const PAGE_SIZE = 50;

type StatusFilter = 'all' | 'created' | 'paid' | 'cancelled' | 'expired';

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'created', label: 'Created' },
  { value: 'paid', label: 'Paid' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'expired', label: 'Expired' },
];

const SR_ONLY: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
};

function linkUrl(link: SabpayPaymentLink): string {
  if (link.shortUrl) return link.shortUrl;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/pay/${link.id}`;
}

export function PaymentLinksClient({
  initialLinks,
  mode,
}: {
  initialLinks: SabpayPaymentLink[];
  mode: SabpayMode;
}) {
  const router = useRouter();
  const [links, setLinks] = React.useState<SabpayPaymentLink[]>(initialLinks);
  const [hasMore, setHasMore] = React.useState(initialLinks.length >= PAGE_SIZE);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [filter, setFilter] = React.useState<StatusFilter>('all');

  // Create-modal state.
  const [createOpen, setCreateOpen] = React.useState(false);
  const [amount, setAmount] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [referenceId, setReferenceId] = React.useState('');
  const [customerName, setCustomerName] = React.useState('');
  const [customerEmail, setCustomerEmail] = React.useState('');
  const [customerPhone, setCustomerPhone] = React.useState('');
  const [expireBy, setExpireBy] = React.useState<Date | undefined>(undefined);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);

  const [cancelTarget, setCancelTarget] = React.useState<SabpayPaymentLink | null>(null);

  // Resync after router.refresh() re-fetches the first page on the server.
  React.useEffect(() => {
    setLinks(initialLinks);
    setHasMore(initialLinks.length >= PAGE_SIZE);
  }, [initialLinks]);

  const visible =
    filter === 'all' ? links : links.filter((l) => l.status === filter);

  function resetForm() {
    setAmount('');
    setDescription('');
    setReferenceId('');
    setCustomerName('');
    setCustomerEmail('');
    setCustomerPhone('');
    setExpireBy(undefined);
    setFormError(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const rupees = Number.parseFloat(amount);
    if (!Number.isFinite(rupees) || rupees < 1) {
      setFormError('Enter an amount of at least ₹1.');
      return;
    }
    setCreating(true);
    const result = await createSabpayPaymentLink({
      amount: Math.round(rupees * 100),
      description: description || undefined,
      referenceId: referenceId || undefined,
      customerName: customerName || undefined,
      customerEmail: customerEmail || undefined,
      customerPhone: customerPhone || undefined,
      expireBy: expireBy ? expireBy.toISOString() : undefined,
    });
    setCreating(false);
    if (result.error || !result.paymentLink) {
      setFormError(result.error || 'Could not create the payment link.');
      return;
    }
    setCreateOpen(false);
    resetForm();
    const url = linkUrl(result.paymentLink);
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: 'Payment link created',
        description: 'Link copied to clipboard — share it anywhere.',
        tone: 'success',
      });
    } catch {
      toast({ title: 'Payment link created', description: url });
    }
    router.refresh();
  }

  async function copyLink(link: SabpayPaymentLink) {
    const url = linkUrl(link);
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Link copied to clipboard', tone: 'success' });
    } catch {
      toast({ title: 'Payment link', description: url });
    }
  }

  async function handleCancelConfirm() {
    if (!cancelTarget) return;
    const result = await cancelSabpayPaymentLink(cancelTarget.id);
    if (result.error || !result.paymentLink) {
      const message = result.error || 'Could not cancel the payment link.';
      toast({ title: 'Cancel failed', description: message, tone: 'danger' });
      throw new Error(message);
    }
    const updated = result.paymentLink;
    setLinks((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    toast({ title: 'Payment link cancelled', tone: 'success' });
    router.refresh();
  }

  async function loadMore() {
    const last = links[links.length - 1];
    if (!last) return;
    setLoadingMore(true);
    try {
      const more = await getSabpayPaymentLinks({
        limit: PAGE_SIZE,
        before: last.createdAt,
        mode,
      });
      setLinks((prev) => {
        const seen = new Set(prev.map((l) => l.id));
        return [...prev, ...more.filter((l) => !seen.has(l.id))];
      });
      setHasMore(more.length >= PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <>
      <ListToolbar
        left={
          <SegmentedControl
            aria-label="Filter payment links by status"
            items={FILTERS}
            value={filter}
            onChange={setFilter}
          />
        }
        actions={
          <Button
            variant="primary"
            iconLeft={<Plus size={15} />}
            onClick={() => setCreateOpen(true)}
          >
            Create payment link
          </Button>
        }
      />

      <Card>
        <CardBody>
          {visible.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--st-text-muted)' }}>
              No {filter === 'all' ? '' : `${filter} `}payment links in {mode} mode yet.
            </p>
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Link</Th>
                  <Th>Amount</Th>
                  <Th>Status</Th>
                  <Th>Customer</Th>
                  <Th>Expires</Th>
                  <Th>Created</Th>
                  <Th>
                    <span style={SR_ONLY}>Actions</span>
                  </Th>
                </Tr>
              </THead>
              <TBody>
                {visible.map((l) => (
                  <Tr key={l.id}>
                    <Td>
                      <Link
                        href={`/sabpay/payment-links/${l.id}`}
                        style={{ fontFamily: 'var(--st-font-mono, monospace)', fontSize: 12.5 }}
                      >
                        {l.id}
                      </Link>
                    </Td>
                    <Td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      {formatSabpayAmount(l.amount, l.currency)}
                    </Td>
                    <Td>
                      <EntityStatusBadge status={l.status} />
                    </Td>
                    <Td>{l.customerName || l.customerEmail || '—'}</Td>
                    <Td>{l.expireBy ? new Date(l.expireBy).toLocaleString() : '—'}</Td>
                    <Td>{new Date(l.createdAt).toLocaleString()}</Td>
                    <Td>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            iconLeft={<MoreHorizontal size={15} />}
                            aria-label={`Actions for ${l.id}`}
                          />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => void copyLink(l)}>
                            <Link2 size={14} style={{ marginRight: 8 }} />
                            Copy link
                          </DropdownMenuItem>
                          {l.status === 'created' ? (
                            <DropdownMenuItem onClick={() => setCancelTarget(l)}>
                              <XCircle size={14} style={{ marginRight: 8 }} />
                              Cancel link
                            </DropdownMenuItem>
                          ) : null}
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

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create a payment link"
        description={`Creates a ${mode}-mode link and copies its URL — share it anywhere.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="sabpay-create-payment-link"
              disabled={creating}
            >
              {creating ? 'Creating…' : 'Create link'}
            </Button>
          </>
        }
      >
        <form
          id="sabpay-create-payment-link"
          onSubmit={handleCreate}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <Field label="Amount (₹)" required error={formError}>
            <Input
              type="number"
              min={1}
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="499"
              required
            />
          </Field>
          <Field label="Description" help="Shown to the customer on the checkout page.">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Pro plan, March"
              maxLength={200}
            />
          </Field>
          <Field label="Reference ID" help="Optional. Your internal id for reconciliation.">
            <Input
              value={referenceId}
              onChange={(e) => setReferenceId(e.target.value)}
              placeholder="INV-2041"
              maxLength={100}
            />
          </Field>
          <Field label="Customer name" help="Optional. Prefilled on the checkout page.">
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Asha Patel"
              maxLength={100}
            />
          </Field>
          <Field label="Customer email">
            <Input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="asha@example.com"
            />
          </Field>
          <Field label="Customer phone">
            <Input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="+91 98765 43210"
              maxLength={20}
            />
          </Field>
          <Field
            label="Expires"
            help="Optional. The link stops accepting payments after this date."
          >
            <DatePicker
              value={expireBy}
              onChange={setExpireBy}
              placeholder="No expiry"
              disabledDates={{ before: new Date() }}
              aria-label="Link expiry date"
            />
          </Field>
        </form>
      </Modal>

      <ConfirmAction
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancelConfirm}
        title="Cancel this payment link?"
        description={
          cancelTarget
            ? `${cancelTarget.id} will stop accepting payments immediately. This cannot be undone.`
            : undefined
        }
        confirmLabel="Cancel link"
      />
    </>
  );
}
