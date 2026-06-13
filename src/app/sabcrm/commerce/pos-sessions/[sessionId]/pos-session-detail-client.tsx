'use client';

/**
 * SabCRM Commerce — POS session cash-summary detail client
 * (spec WI-18 — bespoke, NOT DocDetailPage: sessions have no line
 * items).
 *
 * StatusFlow header + cash-summary cards (opening / expected /
 * closing / discrepancy) + a transactions table (filtered `sessionId`)
 * + Close / Reconcile dialogs (closing-cash input). When the session
 * is open, a CTA deep-links to the register at
 * `/sabcrm/commerce/register?sessionId=<id>`. Every action re-runs the
 * full session → project → RBAC → plan gate.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Banknote, Store } from 'lucide-react';

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
  EmptyState,
  Field,
  Input,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  toast,
  type BadgeTone,
} from '@/components/sabcrm/20ui';

import { StatusFlow } from '@/app/sabcrm/finance/_components/doc-surface';
import { POS_SESSION_FLOW, POS_SESSION_STATUSES, POS_SESSIONS_PATH } from '../pos-sessions-config';
import { posTransactionDetailHref } from '../../pos-transactions/pos-transactions-config';

import {
  closeSabcrmPosSession,
  reconcileSabcrmPosSession,
} from '@/app/actions/sabcrm-commerce.actions';
import type { SabcrmPosSessionListRow } from '@/app/actions/sabcrm-commerce-pos-sessions.actions.types';

import '@/components/sabcrm/20ui/surface-crm-base.css';

const TXN_TONE: Record<string, BadgeTone> = {
  completed: 'success',
  voided: 'danger',
  refunded: 'neutral',
  partially_refunded: 'warning',
};

interface TxnRow {
  id: string;
  transactionNumber: string;
  createdAt: string;
  total: number;
  paymentMethod: string;
  status: string;
}

function fmtMoney(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return '—';
  }
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

function fmtDate(iso: string | null | undefined): string {
  const day = (iso ?? '').slice(0, 10);
  const [y, m, d] = day.split('-');
  if (!y || !m || !d) return day || '—';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(d)} ${months[Number(m) - 1] ?? m} ${y}`;
}

function CashCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'danger' | 'success';
}): React.JSX.Element {
  return (
    <Card variant="outlined">
      <CardBody>
        <p className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
          {label}
        </p>
        <p
          className={
            tone === 'danger'
              ? 'mt-1 text-lg font-semibold text-[var(--st-danger)]'
              : tone === 'success'
                ? 'mt-1 text-lg font-semibold text-[var(--st-success)]'
                : 'mt-1 text-lg font-semibold text-[var(--st-text)]'
          }
        >
          {value}
        </p>
      </CardBody>
    </Card>
  );
}

export interface PosSessionDetailClientProps {
  session: SabcrmPosSessionListRow;
  transactions: TxnRow[];
}

export function PosSessionDetailClient({
  session,
  transactions,
}: PosSessionDetailClientProps): React.JSX.Element {
  const router = useRouter();
  const [closeOpen, setCloseOpen] = React.useState(false);
  const [closingCash, setClosingCash] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const isOpen = session.status === 'open';
  const isClosed = session.status === 'closed';

  const txnTotal = transactions
    .filter((t) => t.status === 'completed')
    .reduce((sum, t) => sum + t.total, 0);

  const submitClose = (): void => {
    if (!closingCash.trim() || !Number.isFinite(Number(closingCash))) {
      setError('Counted closing cash must be a number.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await closeSabcrmPosSession(session.id, Number(closingCash));
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success('Session closed.');
      setCloseOpen(false);
      router.refresh();
    });
  };

  const reconcile = (): void => {
    setError(null);
    startTransition(async () => {
      const res = await reconcileSabcrmPosSession(session.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Session reconciled.');
      router.refresh();
    });
  };

  return (
    <div className="mx-auto w-full max-w-[1120px] px-6 pb-12 pt-6">
      <Link
        href={POS_SESSIONS_PATH}
        className="inline-flex items-center gap-1 text-sm text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
      >
        <ArrowLeft size={14} aria-hidden="true" /> POS sessions
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-xl font-semibold tracking-tight text-[var(--st-text)]">
            Terminal {session.terminalId}
          </h1>
          <p className="mt-1 text-sm text-[var(--st-text-secondary)]">
            Opened {fmtDate(session.openedAt)} by {session.openedBy}
          </p>
          <div className="mt-2">
            <StatusFlow
              flow={POS_SESSION_FLOW}
              statuses={POS_SESSION_STATUSES}
              current={session.status}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isOpen ? (
            <Button variant="secondary" iconLeft={Store} asChild>
              <Link
                href={`/sabcrm/commerce/register?sessionId=${encodeURIComponent(session.id)}`}
              >
                Open register
              </Link>
            </Button>
          ) : null}
          {isOpen ? (
            <Button
              variant="primary"
              iconLeft={Banknote}
              loading={pending}
              onClick={() => {
                setError(null);
                setClosingCash('');
                setCloseOpen(true);
              }}
            >
              Close session
            </Button>
          ) : null}
          {isClosed ? (
            <Button variant="primary" loading={pending} onClick={reconcile}>
              Reconcile
            </Button>
          ) : null}
        </div>
      </div>

      {error && !closeOpen ? (
        <div className="my-4">
          <Alert tone="danger" role="alert">
            {error}
          </Alert>
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <CashCard label="Opening cash" value={fmtMoney(session.openingCash)} />
        <CashCard label="Expected cash" value={fmtMoney(session.expectedCash)} />
        <CashCard label="Closing cash" value={fmtMoney(session.closingCash)} />
        <CashCard
          label="Discrepancy"
          value={fmtMoney(session.discrepancy)}
          tone={
            session.discrepancy && session.discrepancy !== 0
              ? 'danger'
              : 'success'
          }
        />
      </div>

      {session.notes ? (
        <Card variant="outlined" className="mt-4">
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-sm">{session.notes}</p>
          </CardBody>
        </Card>
      ) : null}

      <div className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-[var(--st-text)]">
          Transactions ({transactions.length}) · sales {fmtMoney(txnTotal)}
        </h2>
        {transactions.length === 0 ? (
          <EmptyState
            icon={Banknote}
            title="No transactions yet"
            description="Sales rung up against this session will appear here."
          />
        ) : (
          <Table hover>
            <THead>
              <Tr>
                <Th>Number</Th>
                <Th>Time</Th>
                <Th>Payment</Th>
                <Th align="right">Total</Th>
                <Th>Status</Th>
              </Tr>
            </THead>
            <TBody>
              {transactions.map((t) => (
                <Tr key={t.id}>
                  <Td>
                    <Link
                      href={posTransactionDetailHref(t.id)}
                      className="font-mono text-[var(--st-accent)] hover:underline"
                    >
                      {t.transactionNumber}
                    </Link>
                  </Td>
                  <Td>{fmtDate(t.createdAt)}</Td>
                  <Td>{t.paymentMethod}</Td>
                  <Td align="right">{fmtMoney(t.total)}</Td>
                  <Td>
                    <Badge tone={TXN_TONE[t.status] ?? 'neutral'} dot>
                      {t.status}
                    </Badge>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </div>

      <Dialog open={closeOpen} onOpenChange={(next) => !pending && setCloseOpen(next)}>
        <DialogContent aria-describedby="close-session-desc">
          <DialogHeader>
            <DialogTitle>Close session</DialogTitle>
            <DialogDescription id="close-session-desc">
              Count the cash in the drawer and enter the closing total. The
              engine computes the expected cash and discrepancy.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitClose();
            }}
          >
            <div className="flex flex-col gap-3 pb-2 pt-1">
              <Field label="Counted closing cash" required>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={closingCash}
                  onChange={(e) => setClosingCash(e.target.value)}
                  placeholder="0.00"
                  autoFocus
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
                Close session
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
