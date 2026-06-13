'use client';

/**
 * SabCRM Commerce — POS sessions list client
 * (`/sabcrm/commerce/pos-sessions`).
 *
 * Doc-surface adopter (spec WI-18): KPI strip (open / opening float /
 * discrepancies), the config-driven DocListPage and an "Open session"
 * dialog (the full crate `OpenSessionInput` — terminal id, opening
 * cash, notes) as the primary action. Each row links to the bespoke
 * cash-summary detail at `/sabcrm/commerce/pos-sessions/[sessionId]`.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Banknote, Coins, Monitor, Plus, Scale } from 'lucide-react';

import {
  Alert,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Textarea,
  toast,
} from '@/components/sabcrm/20ui';
import { KpiCard } from '@/components/sabcrm/20ui/composites/charts';

import {
  DocListPage,
  formatDocMoney,
  type DocListColumn,
  type DocListPageConfig,
} from '@/app/sabcrm/finance/_components/doc-surface';
import {
  POS_SESSION_STATUSES,
  posSessionDetailHref,
  toPosSessionFilters,
} from './pos-sessions-config';

import {
  exportSabcrmPosSessionRows,
  listSabcrmPosSessionsPage,
} from '@/app/actions/sabcrm-commerce-pos-sessions.actions';
import { openSabcrmPosSession } from '@/app/actions/sabcrm-commerce.actions';
import type {
  SabcrmPosSessionKpis,
  SabcrmPosSessionListRow,
} from '@/app/actions/sabcrm-commerce-pos-sessions.actions.types';

/* ─── Columns ─────────────────────────────────────────────────── */

const COLUMNS: DocListColumn<SabcrmPosSessionListRow>[] = [
  { key: 'terminalId', header: 'Terminal', kind: 'text', value: (r) => r.terminalId },
  { key: 'openedAt', header: 'Opened', kind: 'date', value: (r) => r.openedAt },
  {
    key: 'openingCash',
    header: 'Opening cash',
    kind: 'money',
    value: (r) => r.openingCash,
    currency: () => 'INR',
  },
  {
    key: 'closedAt',
    header: 'Closed',
    kind: 'date',
    value: (r) => r.closedAt ?? '',
  },
  {
    key: 'closingCash',
    header: 'Closing cash',
    kind: 'money',
    value: (r) => r.closingCash ?? 0,
    currency: () => 'INR',
  },
  {
    key: 'discrepancy',
    header: 'Discrepancy',
    kind: 'money',
    value: (r) => r.discrepancy ?? 0,
    currency: () => 'INR',
  },
  { key: 'status', header: 'Status', kind: 'status', value: (r) => r.status },
];

/* ─── Open-session dialog ─────────────────────────────────────── */

interface OpenSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

function OpenSessionDialog({
  open,
  onOpenChange,
  onDone,
}: OpenSessionDialogProps): React.JSX.Element {
  const [terminalId, setTerminalId] = React.useState('');
  const [openingCash, setOpeningCash] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!open) return;
    setTerminalId('');
    setOpeningCash('');
    setNotes('');
    setError(null);
  }, [open]);

  const submit = (): void => {
    if (!terminalId.trim()) {
      setError('A terminal id is required.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await openSabcrmPosSession({
        terminalId: terminalId.trim(),
        openingCash: openingCash.trim() ? Number(openingCash) : 0,
        notes: notes.trim() || undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(`Session opened on ${res.data.terminalId}.`);
      onOpenChange(false);
      onDone();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent aria-describedby="open-session-desc">
        <DialogHeader>
          <DialogTitle>Open POS session</DialogTitle>
          <DialogDescription id="open-session-desc">
            Start a register session by counting the opening cash float.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-col gap-3 pb-2 pt-1">
            <Field label="Terminal id" required>
              <Input
                value={terminalId}
                onChange={(e) => setTerminalId(e.target.value)}
                placeholder="till-1"
                autoFocus
                disabled={pending}
              />
            </Field>
            <Field label="Opening cash">
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                placeholder="0.00"
                disabled={pending}
              />
            </Field>
            <Field label="Notes">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Optional"
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
              Open session
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main client ─────────────────────────────────────────────── */

export interface PosSessionsClientProps {
  initialRows: SabcrmPosSessionListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmPosSessionKpis | null;
}

export function PosSessionsClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
}: PosSessionsClientProps): React.JSX.Element {
  const router = useRouter();
  const [refreshToken, setRefreshToken] = React.useState(0);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const config = React.useMemo<DocListPageConfig<SabcrmPosSessionListRow>>(
    () => ({
      title: 'POS sessions',
      description:
        'Cash-register sessions — opening float through close and reconciliation.',
      icon: Monitor,
      entity: { singular: 'session', plural: 'sessions' },
      columns: COLUMNS,
      statuses: POS_SESSION_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmPosSessionsPage(toPosSessionFilters(filters));
        return res.ok
          ? { ok: true, data: { rows: res.data.rows, hasMore: res.data.hasMore } }
          : res;
      },
      fetchAllForCsv: (filters) =>
        exportSabcrmPosSessionRows(toPosSessionFilters(filters)),
      csvFileName: 'pos-sessions.csv',
      rowHref: (row) => posSessionDetailHref(row.id),
      rowLabel: (row) => `session on ${row.terminalId}`,
    }),
    [],
  );

  const kpiStrip = kpis ? (
    <>
      <KpiCard
        label="Open sessions"
        icon={Monitor}
        value={String(kpis.openCount)}
        delta={`of ${kpis.count} total`}
        deltaTone={kpis.openCount > 0 ? 'up' : 'neutral'}
      />
      <KpiCard
        label="Opening float"
        icon={Banknote}
        value={formatDocMoney(kpis.openingCashTotal, kpis.currency)}
        delta={kpis.sampled ? 'Across the latest sample' : 'All sessions'}
      />
      <KpiCard
        label="Closed / reconciled"
        icon={Coins}
        value={String(kpis.closedCount)}
        delta="Settled sessions"
      />
      <KpiCard
        label="Total discrepancy"
        icon={Scale}
        value={formatDocMoney(kpis.discrepancyTotal, kpis.currency)}
        delta="Absolute cash variance"
        deltaTone={kpis.discrepancyTotal > 0 ? 'down' : 'neutral'}
      />
    </>
  ) : null;

  const handleDone = (): void => {
    setRefreshToken((t) => t + 1);
    router.refresh();
  };

  return (
    <>
      <DocListPage
        config={config}
        kpis={kpiStrip}
        primaryAction={
          <Button
            variant="primary"
            iconLeft={Plus}
            onClick={() => setDialogOpen(true)}
          >
            Open session
          </Button>
        }
        initialRows={initialRows}
        initialHasMore={initialHasMore}
        initialError={initialError}
        refreshToken={refreshToken}
      />

      <OpenSessionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onDone={handleDone}
      />
    </>
  );
}
