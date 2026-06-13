'use client';

/**
 * SabCRM Supply — RFQ detail client (`/sabcrm/supply/rfqs/[id]`),
 * rollout WI-8.
 *
 * Composes the doc-surface `DocDetailPage` with the RFQ workflow:
 *
 *   - header: StatusFlow rail + actions (Open / Close / Cancel
 *     transitions, Edit, Print);
 *   - paper: NO party (RFQs are broadcast, not addressed), meta
 *     (required-by, bid deadline, invited vendors — resolved labels),
 *     no-price requested lines (qty / unit / specs), terms;
 *   - rail: a BIDS table (vendor label, total, lead time, status) with
 *     shortlist / award / reject actions — awarding a bid cascades the
 *     RFQ to `awarded`, and a "Create PO" link routes to the awarded
 *     bid's detail where the bid → PO convert lives (rollout WI-9);
 *   - edit: the same bespoke `RfqDrawer` the list uses, seeded server-
 *     side.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Award,
  CheckCircle2,
  FilePenLine,
  Printer,
  Send,
  Star,
  XCircle,
} from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  IconButton,
  toast,
} from '@/components/sabcrm/20ui';

import {
  ConvertMenu,
  DocDetailPage,
  formatDocMoney,
  type ConvertMenuItem,
  type DocDetailLine,
} from '@/app/sabcrm/finance/_components/doc-surface';
import { RFQ_FLOW, RFQ_STATUSES, RFQS_PATH } from '../rfqs-config';
import { RfqDrawer, type RfqFormSeed } from '../rfqs-client';

import { transitionSabcrmSupplyRfqStatus } from '@/app/actions/sabcrm-supply-docs.actions';
import {
  awardSabcrmSupplyRfqBid,
  setSabcrmSupplyRfqBidStatus,
} from '@/app/actions/sabcrm-supply-rfqs.actions';
import { deleteSabcrmSupplyRfq } from '@/app/actions/sabcrm-supply.actions';
import type {
  SabcrmRfqStatus,
} from '@/app/actions/sabcrm-supply-docs.actions.types';
import { SABCRM_RFQ_TRANSITIONS } from '@/app/actions/sabcrm-supply-docs.actions.types';
import type { SabcrmRfqBidRow } from '@/app/actions/sabcrm-supply-rfqs.actions.types';

/* ─── Public line shape (resolved server-side) ─────────────────── */

export interface RfqDetailLine {
  label: string;
  qty: number;
  unit?: string;
  specs?: string;
}

const VENDOR_BIDS_PATH = '/sabcrm/supply/vendor-bids';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
}

function bidStatusTone(
  status: string,
): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  switch (status) {
    case 'awarded':
      return 'success';
    case 'shortlisted':
      return 'warning';
    case 'rejected':
    case 'withdrawn':
      return 'danger';
    default:
      return 'info';
  }
}

/* ─── Bids rail card ──────────────────────────────────────────── */

interface BidsCardProps {
  bids: SabcrmRfqBidRow[];
  busy: boolean;
  rfqId: string;
  onShortlist: (bid: SabcrmRfqBidRow) => void;
  onAward: (bid: SabcrmRfqBidRow) => void;
  onReject: (bid: SabcrmRfqBidRow) => void;
}

function BidsCard({
  bids,
  busy,
  onShortlist,
  onAward,
  onReject,
}: BidsCardProps): React.JSX.Element {
  return (
    <Card variant="outlined">
      <CardHeader>
        <CardTitle>
          <span className="inline-flex items-center gap-1.5">
            <Award size={14} aria-hidden="true" /> Bids ({bids.length})
          </span>
        </CardTitle>
      </CardHeader>
      <CardBody>
        {bids.length === 0 ? (
          <span className="fdoc-cell-sub">
            No bids yet — invited vendors submit priced bids here.
          </span>
        ) : (
          <ul className="fdoc-rail-list">
            {bids.map((bid) => {
              const awarded = bid.status === 'awarded';
              return (
                <li key={bid.id} className="flex flex-col gap-1.5 py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`${VENDOR_BIDS_PATH}/${encodeURIComponent(bid.id)}`}
                      className="text-sm font-medium text-[var(--st-accent)] hover:underline"
                    >
                      {bid.vendorLabel}
                    </Link>
                    <span className="text-sm font-semibold">
                      {formatDocMoney(bid.total, bid.currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="fdoc-cell-sub">
                      {bid.leadTimeDays != null
                        ? `${bid.leadTimeDays}d lead`
                        : 'No lead time'}
                      {' · '}
                      {fmtDate(bid.submittedAt)}
                    </span>
                    <Badge tone={bidStatusTone(bid.status)}>{bid.status}</Badge>
                  </div>
                  {awarded ? (
                    <Link
                      href={`${VENDOR_BIDS_PATH}/${encodeURIComponent(bid.id)}`}
                      className="text-xs font-medium text-[var(--st-accent)] hover:underline"
                    >
                      Create a PO from this bid →
                    </Link>
                  ) : (
                    <div className="flex items-center gap-1">
                      <IconButton
                        icon={Star}
                        label="Shortlist bid"
                        variant="ghost"
                        disabled={busy || bid.status === 'shortlisted'}
                        onClick={() => onShortlist(bid)}
                      />
                      <IconButton
                        icon={CheckCircle2}
                        label="Award bid"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => onAward(bid)}
                      />
                      <IconButton
                        icon={XCircle}
                        label="Reject bid"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => onReject(bid)}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

/* ─── Main client ─────────────────────────────────────────────── */

export interface RfqDetailClientProps {
  rfqId: string;
  title: string;
  status: string;
  requiredBy: string | null;
  deadline: string | null;
  terms: string | null;
  invitedVendors: { id: string; label: string }[];
  lines: RfqDetailLine[];
  bids: SabcrmRfqBidRow[];
  seed: RfqFormSeed | null;
  error: string | null;
}

export function RfqDetailClient({
  rfqId,
  title,
  status,
  requiredBy,
  deadline,
  terms,
  invitedVendors,
  lines,
  bids,
  seed,
  error,
}: RfqDetailClientProps): React.JSX.Element {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [busy, startTransition] = React.useTransition();

  const refresh = React.useCallback(() => router.refresh(), [router]);

  if (error || !seed) {
    return (
      <DocDetailPage
        backHref={RFQS_PATH}
        backLabel="RFQs"
        docNumber="RFQ"
        entitySingular="RFQ"
        statuses={RFQ_STATUSES}
        flow={RFQ_FLOW}
        status="draft"
        party={null}
        meta={[]}
        currency="INR"
        lines={[]}
        totals={{ subTotal: 0, total: 0 }}
        related={[]}
        error={error ?? 'RFQ not found.'}
      />
    );
  }

  const current = (status || 'draft') as SabcrmRfqStatus;
  const allowedNext = SABCRM_RFQ_TRANSITIONS[current] ?? [];

  const transition = (next: SabcrmRfqStatus, success: string): void => {
    startTransition(async () => {
      const res = await transitionSabcrmSupplyRfqStatus(rfqId, next);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(success);
      refresh();
    });
  };

  const onShortlist = (bid: SabcrmRfqBidRow): void => {
    startTransition(async () => {
      const res = await setSabcrmSupplyRfqBidStatus(rfqId, bid.id, 'shortlisted');
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${bid.vendorLabel} shortlisted.`);
      refresh();
    });
  };

  const onAward = (bid: SabcrmRfqBidRow): void => {
    startTransition(async () => {
      const res = await awardSabcrmSupplyRfqBid(rfqId, bid.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `${bid.vendorLabel} awarded. Open the bid to create a purchase order.`,
      );
      refresh();
    });
  };

  const onReject = (bid: SabcrmRfqBidRow): void => {
    startTransition(async () => {
      const res = await setSabcrmSupplyRfqBidStatus(rfqId, bid.id, 'rejected');
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${bid.vendorLabel} rejected.`);
      refresh();
    });
  };

  const handleDelete = (): void => {
    startTransition(async () => {
      const res = await deleteSabcrmSupplyRfq(rfqId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${title} deleted.`);
      router.push(RFQS_PATH);
      router.refresh();
    });
  };

  /* ---- actions bar ---- */
  const menuItems: ConvertMenuItem[] = [];
  if (allowedNext.includes('closed')) {
    menuItems.push({
      key: 'close',
      label: 'Close RFQ',
      icon: XCircle,
      onSelect: () => transition('closed', `${title} closed.`),
    });
  }
  if (allowedNext.includes('cancelled')) {
    menuItems.push({
      key: 'cancel',
      label: 'Cancel RFQ',
      icon: XCircle,
      danger: true,
      group: menuItems.length > 0,
      onSelect: () => transition('cancelled', `${title} cancelled.`),
    });
  }
  if (allowedNext.includes('draft')) {
    menuItems.push({
      key: 'reopen',
      label: 'Reopen as draft',
      icon: Send,
      onSelect: () => transition('draft', `${title} reopened as draft.`),
    });
  }
  menuItems.push({
    key: 'delete',
    label: 'Delete RFQ',
    icon: XCircle,
    danger: true,
    group: true,
    onSelect: handleDelete,
  });

  const actions = (
    <>
      {allowedNext.includes('open') ? (
        <Button
          variant="primary"
          iconLeft={Send}
          loading={busy}
          onClick={() => transition('open', `${title} opened for bidding.`)}
        >
          Open for bidding
        </Button>
      ) : null}
      <Button
        variant="secondary"
        iconLeft={Printer}
        onClick={() => window.print()}
      >
        Print
      </Button>
      {current !== 'awarded' && current !== 'cancelled' ? (
        <Button
          variant="secondary"
          iconLeft={FilePenLine}
          onClick={() => setEditOpen(true)}
        >
          Edit
        </Button>
      ) : null}
      <ConvertMenu label="More" items={menuItems} disabled={busy} />
    </>
  );

  /* ---- paper data ---- */
  const detailLines: DocDetailLine[] = lines.map((l) => ({
    description: l.specs ? `${l.label} — ${l.specs}` : l.label,
    qty: l.qty,
    unit: l.unit,
    rate: 0,
    total: 0,
  }));

  const meta: { label: string; value: React.ReactNode }[] = [
    { label: 'Required by', value: fmtDate(requiredBy) },
    { label: 'Bid deadline', value: fmtDate(deadline) },
    {
      label: 'Invited vendors',
      value:
        invitedVendors.length > 0
          ? invitedVendors.map((v) => v.label).join(', ')
          : 'None invited',
    },
    { label: 'Bids received', value: String(bids.length) },
  ];

  return (
    <>
      <DocDetailPage
        backHref={RFQS_PATH}
        backLabel="RFQs"
        docNumber={title}
        entitySingular="RFQ"
        statuses={RFQ_STATUSES}
        flow={RFQ_FLOW}
        status={current}
        actions={actions}
        party={null}
        meta={meta}
        currency="INR"
        lines={detailLines}
        totals={{ subTotal: 0, total: 0 }}
        terms={terms}
        related={[]}
        railExtra={
          <BidsCard
            bids={bids}
            busy={busy}
            rfqId={rfqId}
            onShortlist={onShortlist}
            onAward={onAward}
            onReject={onReject}
          />
        }
      />

      <RfqDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        seed={seed}
        onDone={refresh}
      />
    </>
  );
}
