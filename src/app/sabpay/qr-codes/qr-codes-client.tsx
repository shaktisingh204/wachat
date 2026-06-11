'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, Plus, QrCode as QrCodeIcon, XCircle } from 'lucide-react';
import QRCode from 'react-qr-code';

import {
  Button,
  Card,
  CardBody,
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
  type SabpayQrCode,
} from '@/lib/sabpay/types';

import {
  closeSabpayQrCode,
  createSabpayQrCode,
  getSabpayQrCodes,
} from '../actions/qr-codes';
import { ConfirmAction } from '../_components/confirm-action';
import { EntityStatusBadge } from '../_components/entity-status-badge';
import { ListToolbar } from '../_components/list-toolbar';
import { LoadMore } from '../_components/load-more';

const PAGE_SIZE = 50;

type StatusFilter = 'all' | 'active' | 'closed';
type AmountType = 'fixed' | 'any';
type UsageType = 'single_use' | 'multiple_use';

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'closed', label: 'Closed' },
];

const AMOUNT_TYPES: Array<{ value: AmountType; label: string }> = [
  { value: 'fixed', label: 'Fixed amount' },
  { value: 'any', label: 'Any amount' },
];

const USAGE_TYPES: Array<{ value: UsageType; label: string }> = [
  { value: 'multiple_use', label: 'Multiple payments' },
  { value: 'single_use', label: 'Single payment' },
];

const SR_ONLY: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
};

function qrUrl(qr: SabpayQrCode): string {
  if (qr.payloadUrl) return qr.payloadUrl;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/pay/${qr.id}`;
}

function usageLabel(usage: string): string {
  if (usage === 'single_use') return 'Single use';
  if (usage === 'multiple_use') return 'Multiple use';
  return usage;
}

export function QrCodesClient({
  initialQrCodes,
  mode,
}: {
  initialQrCodes: SabpayQrCode[];
  mode: SabpayMode;
}) {
  const router = useRouter();
  const [qrCodes, setQrCodes] = React.useState<SabpayQrCode[]>(initialQrCodes);
  const [hasMore, setHasMore] = React.useState(initialQrCodes.length >= PAGE_SIZE);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [filter, setFilter] = React.useState<StatusFilter>('all');

  // Create-modal state.
  const [createOpen, setCreateOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [amountType, setAmountType] = React.useState<AmountType>('fixed');
  const [amount, setAmount] = React.useState('');
  const [usage, setUsage] = React.useState<UsageType>('multiple_use');
  const [formError, setFormError] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);

  const [showTarget, setShowTarget] = React.useState<SabpayQrCode | null>(null);
  const [closeTarget, setCloseTarget] = React.useState<SabpayQrCode | null>(null);

  // Resync after router.refresh() re-fetches the first page on the server.
  React.useEffect(() => {
    setQrCodes(initialQrCodes);
    setHasMore(initialQrCodes.length >= PAGE_SIZE);
  }, [initialQrCodes]);

  const visible =
    filter === 'all' ? qrCodes : qrCodes.filter((q) => q.status === filter);

  function resetForm() {
    setName('');
    setAmountType('fixed');
    setAmount('');
    setUsage('multiple_use');
    setFormError(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    let paise: number | undefined;
    if (amountType === 'fixed') {
      const rupees = Number.parseFloat(amount);
      if (!Number.isFinite(rupees) || rupees < 1) {
        setFormError('Enter an amount of at least ₹1.');
        return;
      }
      paise = Math.round(rupees * 100);
    }
    setCreating(true);
    const result = await createSabpayQrCode({
      name: name || undefined,
      usage,
      fixedAmount: amountType === 'fixed',
      amount: paise,
    });
    setCreating(false);
    if (result.error || !result.qrCode) {
      setFormError(result.error || 'Could not create the QR code.');
      return;
    }
    setCreateOpen(false);
    resetForm();
    toast({ title: 'QR code created', tone: 'success' });
    setShowTarget(result.qrCode);
    router.refresh();
  }

  async function handleCloseConfirm() {
    if (!closeTarget) return;
    const result = await closeSabpayQrCode(closeTarget.id);
    if (result.error || !result.qrCode) {
      const message = result.error || 'Could not close the QR code.';
      toast({ title: 'Close failed', description: message, tone: 'danger' });
      throw new Error(message);
    }
    const updated = result.qrCode;
    setQrCodes((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
    toast({ title: 'QR code closed', tone: 'success' });
    router.refresh();
  }

  async function loadMore() {
    const last = qrCodes[qrCodes.length - 1];
    if (!last) return;
    setLoadingMore(true);
    try {
      const more = await getSabpayQrCodes({
        limit: PAGE_SIZE,
        before: last.createdAt,
        mode,
      });
      setQrCodes((prev) => {
        const seen = new Set(prev.map((q) => q.id));
        return [...prev, ...more.filter((q) => !seen.has(q.id))];
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
            aria-label="Filter QR codes by status"
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
            Create QR code
          </Button>
        }
      />

      <Card>
        <CardBody>
          {visible.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--st-text-muted)' }}>
              No {filter === 'all' ? '' : `${filter} `}QR codes in {mode} mode yet.
            </p>
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>QR code</Th>
                  <Th>Label</Th>
                  <Th>Amount</Th>
                  <Th>Usage</Th>
                  <Th>Status</Th>
                  <Th>Payments</Th>
                  <Th>Created</Th>
                  <Th>
                    <span style={SR_ONLY}>Actions</span>
                  </Th>
                </Tr>
              </THead>
              <TBody>
                {visible.map((q) => (
                  <Tr key={q.id}>
                    <Td>
                      <Link
                        href={`/sabpay/qr-codes/${q.id}`}
                        style={{ fontFamily: 'var(--st-font-mono, monospace)', fontSize: 12.5 }}
                      >
                        {q.id}
                      </Link>
                    </Td>
                    <Td>{q.name || '—'}</Td>
                    <Td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      {q.fixedAmount && q.amount != null
                        ? formatSabpayAmount(q.amount)
                        : 'Any amount'}
                    </Td>
                    <Td>{usageLabel(q.usage)}</Td>
                    <Td>
                      <EntityStatusBadge status={q.status} />
                    </Td>
                    <Td style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {q.paymentsCountReceived}
                    </Td>
                    <Td>{new Date(q.createdAt).toLocaleString()}</Td>
                    <Td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          iconLeft={<QrCodeIcon size={14} />}
                          onClick={() => setShowTarget(q)}
                        >
                          Show QR
                        </Button>
                        {q.status === 'active' ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                iconLeft={<MoreHorizontal size={15} />}
                                aria-label={`Actions for ${q.id}`}
                              />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setCloseTarget(q)}>
                                <XCircle size={14} style={{ marginRight: 8 }} />
                                Close QR
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </span>
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
        title="Create a QR code"
        description={`Creates a ${mode}-mode collect QR — print it or show it on screen to get paid.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="sabpay-create-qr-code"
              disabled={creating}
            >
              {creating ? 'Creating…' : 'Create QR code'}
            </Button>
          </>
        }
      >
        <form
          id="sabpay-create-qr-code"
          onSubmit={handleCreate}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <Field label="Label" help="For your reference — e.g. the counter or store it sits at.">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Front counter"
              maxLength={100}
            />
          </Field>
          <Field label="Amount type">
            <SegmentedControl
              aria-label="QR amount type"
              items={AMOUNT_TYPES}
              value={amountType}
              onChange={setAmountType}
            />
          </Field>
          {amountType === 'fixed' ? (
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
          ) : (
            <Field
              label="Amount"
              help="Customers choose how much to pay when they scan."
              error={formError}
            >
              <Input value="Decided by the customer" disabled readOnly />
            </Field>
          )}
          <Field
            label="Usage"
            help="Single-payment QRs close automatically after the first successful payment."
          >
            <SegmentedControl
              aria-label="QR usage"
              items={USAGE_TYPES}
              value={usage}
              onChange={setUsage}
            />
          </Field>
        </form>
      </Modal>

      <Modal
        open={showTarget !== null}
        onClose={() => setShowTarget(null)}
        title={showTarget?.name || showTarget?.id || 'QR code'}
        description="Customers scan this code to open the hosted payment page."
      >
        {showTarget ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 14,
              padding: '6px 0',
            }}
          >
            <div
              style={{
                background: '#ffffff',
                padding: 16,
                borderRadius: 12,
                border: '1px solid var(--st-border)',
                display: 'inline-flex',
              }}
            >
              <QRCode value={qrUrl(showTarget)} size={208} />
            </div>
            <p
              style={{
                margin: 0,
                fontFamily: 'var(--st-font-mono, monospace)',
                fontSize: 12.5,
                color: 'var(--st-text-muted)',
                overflowWrap: 'anywhere',
                textAlign: 'center',
              }}
            >
              {qrUrl(showTarget)}
            </p>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--st-text-muted)' }}>
              {showTarget.fixedAmount && showTarget.amount != null
                ? formatSabpayAmount(showTarget.amount)
                : 'Any amount'}
              {' · '}
              {usageLabel(showTarget.usage)}
            </p>
          </div>
        ) : null}
      </Modal>

      <ConfirmAction
        open={closeTarget !== null}
        onClose={() => setCloseTarget(null)}
        onConfirm={handleCloseConfirm}
        title="Close this QR code?"
        description={
          closeTarget
            ? `${closeTarget.id} will stop accepting payments immediately. This cannot be undone.`
            : undefined
        }
        confirmLabel="Close QR"
      />
    </>
  );
}
