'use client';

/**
 * SabCRM Commerce — POS transaction detail client (DocDetailPage
 * adopter, spec WI-19).
 *
 * The register sale on the doc-surface paper: customer (or "Walk-in")
 * as the party, line items + totals as the document body, session /
 * cashier / payment method + splits in the meta. Header actions:
 * Void (reason dialog) + Refund (line-pick dialog feeding
 * `refundedLineItems`). The rail lists every refund minted against the
 * transaction. Every action re-runs the full gate.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Ban, Undo2 } from 'lucide-react';

import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  SelectField,
  Switch,
  Textarea,
  toast,
} from '@/components/sabcrm/20ui';

import {
  DocDetailPage,
  type DocDetailLine,
  type DocRelatedRef,
} from '@/app/sabcrm/finance/_components/doc-surface';
import {
  POS_TXN_FLOW,
  POS_TXN_STATUSES,
  POS_TRANSACTIONS_PATH,
} from '../pos-transactions-config';
import { posRefundDetailHref } from '../../pos-refunds/pos-refunds-config';

import {
  refundSabcrmPosTransaction,
} from '@/app/actions/sabcrm-commerce-docs.actions';
import { voidSabcrmPosTransaction } from '@/app/actions/sabcrm-commerce.actions';
import type {
  CrmPosTransactionDoc,
  CrmPosRefundDoc,
} from '@/lib/rust-client/sabcrm-commerce';
import type { CrmPosPaymentSplitMethod } from '@/lib/rust-client/crm-pos';

function fmtMoney(amount: number): string {
  if (!Number.isFinite(amount)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `INR ${amount.toFixed(2)}`;
  }
}

const REFUND_METHODS: { value: CrmPosPaymentSplitMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'upi', label: 'UPI' },
  { value: 'wallet', label: 'Wallet' },
];

/* ─── Void dialog ─────────────────────────────────────────────── */

interface VoidDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionId: string;
  onDone: () => void;
}

function VoidDialog({
  open,
  onOpenChange,
  transactionId,
  onDone,
}: VoidDialogProps): React.JSX.Element {
  const [reason, setReason] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!open) return;
    setReason('');
    setError(null);
  }, [open]);

  const submit = (): void => {
    setError(null);
    startTransition(async () => {
      const res = await voidSabcrmPosTransaction(transactionId, reason.trim() || undefined);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success('Transaction voided.');
      onOpenChange(false);
      onDone();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent aria-describedby="void-desc">
        <DialogHeader>
          <DialogTitle>Void transaction</DialogTitle>
          <DialogDescription id="void-desc">
            Voiding cancels the sale. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-col gap-3 pb-2 pt-1">
            <Field label="Reason">
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="Optional"
                disabled={pending}
                autoFocus
              />
            </Field>
            {error ? (
              <Alert tone="danger" role="alert">
                {error}
              </Alert>
            ) : null}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" variant="danger" loading={pending}>
              Void transaction
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Refund dialog ───────────────────────────────────────────── */

interface RefundLineState {
  selected: boolean;
  quantity: string;
  refundAmount: string;
}

interface RefundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: CrmPosTransactionDoc;
  onDone: () => void;
}

function RefundDialog({
  open,
  onOpenChange,
  transaction,
  onDone,
}: RefundDialogProps): React.JSX.Element {
  const [reason, setReason] = React.useState('');
  const [method, setMethod] = React.useState<string | null>('cash');
  const [lines, setLines] = React.useState<RefundLineState[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!open) return;
    setReason('');
    setMethod('cash');
    setError(null);
    setLines(
      transaction.lineItems.map((li) => ({
        selected: false,
        quantity: String(li.quantity),
        refundAmount: String(li.total),
      })),
    );
  }, [open, transaction.lineItems]);

  const setLine = (idx: number, p: Partial<RefundLineState>): void =>
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...p } : l)));

  const submit = (): void => {
    if (!reason.trim()) {
      setError('A refund reason is required.');
      return;
    }
    const refundedLineItems = lines
      .map((l, idx) => ({ l, idx }))
      .filter(({ l }) => l.selected)
      .map(({ l, idx }) => ({
        originalLineItemIndex: idx,
        quantity: Number(l.quantity) || 0,
        refundAmount: Number(l.refundAmount) || 0,
      }));
    if (refundedLineItems.length === 0) {
      setError('Pick at least one line to refund.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await refundSabcrmPosTransaction(transaction._id, {
        reason: reason.trim(),
        refundedLineItems,
        refundMethod: (method ?? 'cash') as CrmPosPaymentSplitMethod,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success('Refund processed.');
      onOpenChange(false);
      onDone();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent aria-describedby="refund-desc">
        <DialogHeader>
          <DialogTitle>Refund transaction</DialogTitle>
          <DialogDescription id="refund-desc">
            Pick the lines to refund and set the quantity and amount per line.
            Totals are recomputed server-side.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto pb-2 pt-1">
            <div className="flex flex-col gap-2">
              {transaction.lineItems.map((li, idx) => {
                const state = lines[idx];
                if (!state) return null;
                return (
                  <div
                    key={idx}
                    className="flex flex-col gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] p-2"
                  >
                    <Switch
                      checked={state.selected}
                      onCheckedChange={(checked) => setLine(idx, { selected: checked })}
                      disabled={pending}
                      label={`${li.name} · ${fmtMoney(li.total)}`}
                    />
                    {state.selected ? (
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Qty">
                          <Input
                            type="number"
                            inputMode="numeric"
                            value={state.quantity}
                            onChange={(e) => setLine(idx, { quantity: e.target.value })}
                            min={0}
                            disabled={pending}
                          />
                        </Field>
                        <Field label="Refund amount">
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            value={state.refundAmount}
                            onChange={(e) => setLine(idx, { refundAmount: e.target.value })}
                            min={0}
                            disabled={pending}
                          />
                        </Field>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <Field label="Refund method" required>
              <SelectField
                value={method}
                onChange={(v) => setMethod(v)}
                options={REFUND_METHODS.map((m) => ({ value: m.value, label: m.label }))}
                disabled={pending}
              />
            </Field>
            <Field label="Reason" required>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="e.g. Damaged item"
                disabled={pending}
              />
            </Field>
            {error ? (
              <Alert tone="danger" role="alert">
                {error}
              </Alert>
            ) : null}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" variant="primary" loading={pending}>
              Process refund
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main detail ─────────────────────────────────────────────── */

export interface PosTransactionDetailClientProps {
  transaction: CrmPosTransactionDoc;
  refunds: CrmPosRefundDoc[];
  sessionLabel: string | null;
  customerLabel: string | null;
}

export function PosTransactionDetailClient({
  transaction,
  refunds,
  sessionLabel,
  customerLabel,
}: PosTransactionDetailClientProps): React.JSX.Element {
  const router = useRouter();
  const [voidOpen, setVoidOpen] = React.useState(false);
  const [refundOpen, setRefundOpen] = React.useState(false);

  const canMutate = transaction.status === 'completed';

  const lines: DocDetailLine[] = transaction.lineItems.map((li) => ({
    description: li.name,
    qty: li.quantity,
    rate: li.rate,
    taxRatePct: li.taxRate,
    total: li.total,
  }));

  const meta: { label: string; value: React.ReactNode }[] = [
    { label: 'Date', value: transaction.createdAt.slice(0, 10) },
    { label: 'Session', value: sessionLabel ?? 'Unknown' },
    { label: 'Cashier', value: transaction.cashierId },
    { label: 'Payment', value: transaction.paymentMethod },
  ];
  if (transaction.paymentSplits?.length) {
    meta.push({
      label: 'Splits',
      value: transaction.paymentSplits
        .map((s) => `${s.method} ${fmtMoney(s.amount)}`)
        .join(' · '),
    });
  }

  const related: DocRelatedRef[] = refunds.map((r) => ({
    kind: 'posRefund',
    id: r._id,
    label: `Refund ${fmtMoney(r.refundTotal)}`,
    href: posRefundDetailHref(r._id),
    date: r.processedAt,
    amount: r.refundTotal,
    status: r.status,
    direction: 'child',
  }));

  const onDone = (): void => router.refresh();

  return (
    <>
      <DocDetailPage
        backHref={POS_TRANSACTIONS_PATH}
        backLabel="POS transactions"
        docNumber={transaction.transactionNumber}
        entitySingular="Transaction"
        statuses={POS_TXN_STATUSES}
        flow={POS_TXN_FLOW}
        status={transaction.status}
        actions={
          canMutate ? (
            <>
              <Button
                variant="secondary"
                iconLeft={Undo2}
                onClick={() => setRefundOpen(true)}
              >
                Refund
              </Button>
              <Button
                variant="ghost"
                iconLeft={Ban}
                onClick={() => setVoidOpen(true)}
              >
                Void
              </Button>
            </>
          ) : (
            <Badge tone="neutral">{transaction.status}</Badge>
          )
        }
        party={{
          label: customerLabel ?? 'Walk-in',
          href: null,
        }}
        meta={meta}
        currency="INR"
        lines={lines}
        totals={{
          subTotal: transaction.subtotal,
          taxTotal: transaction.taxTotal,
          total: transaction.total,
        }}
        related={related}
      />

      <VoidDialog
        open={voidOpen}
        onOpenChange={setVoidOpen}
        transactionId={transaction._id}
        onDone={onDone}
      />
      <RefundDialog
        open={refundOpen}
        onOpenChange={setRefundOpen}
        transaction={transaction}
        onDone={onDone}
      />
    </>
  );
}
