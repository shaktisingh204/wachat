'use client';

/**
 * SabCRM Supply — Vendor bid detail client
 * (`/sabcrm/supply/vendor-bids/[id]`), rollout WI-9.
 *
 * Composes the doc-surface `DocDetailPage` with the bid workflow:
 *
 *   - header: StatusFlow rail + actions (Shortlist / Award / Reject /
 *     Withdraw transitions, "Create PO" convert, Edit, Print);
 *   - paper: vendor party, meta (RFQ link, submitted date, max lead
 *     time, terms), priced lines (qty × rate), totals;
 *   - related rail: the parent RFQ;
 *   - convert: Award → purchase order (`convertSabcrmSupplyVendorBidToPo`
 *     — flips the bid to `awarded` and raises a draft PO with lineage
 *     `fromKind: 'vendorBid'`), routed to via the success toast;
 *   - edit: the same bespoke `BidDrawer` the list uses, seeded server-
 *     side.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Ban,
  CheckCircle2,
  FilePenLine,
  Printer,
  ShoppingCart,
  Star,
  XCircle,
} from 'lucide-react';

import { Button, toast } from '@/components/sabcrm/20ui';

import {
  ConvertMenu,
  DocDetailPage,
  formatDocDate,
  type ConvertMenuItem,
  type DocDetailLine,
  type DocRelatedRef,
} from '@/app/sabcrm/finance/_components/doc-surface';
import {
  BID_FLOW,
  BID_STATUSES,
  VENDOR_BIDS_PATH,
} from '../vendor-bids-config';
import { BidDrawer, type BidFormSeed } from '../vendor-bids-client';

import { updateSabcrmSupplyVendorBidStatus } from '@/app/actions/sabcrm-supply.actions';
import { convertSabcrmSupplyVendorBidToPo } from '@/app/actions/sabcrm-supply-vendor-bids.actions';
import { deleteSabcrmSupplyVendorBid } from '@/app/actions/sabcrm-supply.actions';
import type { SabcrmVendorBidStatus } from '@/app/actions/sabcrm-supply-docs.actions.types';
import { SABCRM_VENDOR_BID_TRANSITIONS } from '@/app/actions/sabcrm-supply-docs.actions.types';

const RFQS_PATH = '/sabcrm/supply/rfqs';

/* ─── Public line shape (resolved server-side) ─────────────────── */

export interface BidDetailLine {
  label: string;
  qty: number;
  rate: number;
  leadTimeDays?: number;
  notes?: string;
}

/* ─── Main client ─────────────────────────────────────────────── */

export interface VendorBidDetailClientProps {
  bidId: string;
  rfqId: string | null;
  rfqLabel: string | null;
  vendorLabel: string | null;
  currency: string;
  status: string;
  submittedAt: string | null;
  terms: string | null;
  lines: BidDetailLine[];
  total: number;
  seed: BidFormSeed | null;
  error: string | null;
}

export function VendorBidDetailClient({
  bidId,
  rfqId,
  rfqLabel,
  vendorLabel,
  currency,
  status,
  submittedAt,
  terms,
  lines,
  total,
  seed,
  error,
}: VendorBidDetailClientProps): React.JSX.Element {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [busy, startTransition] = React.useTransition();

  const refresh = React.useCallback(() => router.refresh(), [router]);

  if (error || !seed) {
    return (
      <DocDetailPage
        backHref={VENDOR_BIDS_PATH}
        backLabel="Vendor bids"
        docNumber="Vendor bid"
        entitySingular="Vendor bid"
        statuses={BID_STATUSES}
        flow={BID_FLOW}
        status="submitted"
        party={null}
        meta={[]}
        currency={currency}
        lines={[]}
        totals={{ subTotal: 0, total: 0 }}
        related={[]}
        error={error ?? 'Vendor bid not found.'}
      />
    );
  }

  const current = (status || 'submitted') as SabcrmVendorBidStatus;
  const allowedNext = SABCRM_VENDOR_BID_TRANSITIONS[current] ?? [];
  const docTitle = `Bid · ${vendorLabel ?? 'Vendor'}`;

  const setStatus = (next: SabcrmVendorBidStatus, success: string): void => {
    startTransition(async () => {
      const res = await updateSabcrmSupplyVendorBidStatus(bidId, next);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(success);
      refresh();
    });
  };

  const convertToPo = (): void => {
    startTransition(async () => {
      const res = await convertSabcrmSupplyVendorBidToPo(bidId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Purchase order ${res.data.number} created.`);
      router.push(res.data.href);
    });
  };

  const handleDelete = (): void => {
    startTransition(async () => {
      const res = await deleteSabcrmSupplyVendorBid(bidId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Bid deleted.');
      router.push(VENDOR_BIDS_PATH);
      router.refresh();
    });
  };

  /* ---- actions bar ---- */
  const menuItems: ConvertMenuItem[] = [];
  if (current !== 'awarded' && current !== 'rejected' && current !== 'withdrawn') {
    menuItems.push({
      key: 'convert-po',
      label: 'Award → create PO',
      description: 'Raises a draft purchase order from this bid',
      icon: ShoppingCart,
      onSelect: convertToPo,
    });
  }
  if (allowedNext.includes('rejected')) {
    menuItems.push({
      key: 'reject',
      label: 'Reject bid',
      icon: XCircle,
      danger: true,
      group: menuItems.length > 0,
      onSelect: () => setStatus('rejected', 'Bid rejected.'),
    });
  }
  if (allowedNext.includes('withdrawn')) {
    menuItems.push({
      key: 'withdraw',
      label: 'Mark withdrawn',
      icon: Ban,
      onSelect: () => setStatus('withdrawn', 'Bid marked withdrawn.'),
    });
  }
  menuItems.push({
    key: 'delete',
    label: 'Delete bid',
    icon: XCircle,
    danger: true,
    group: true,
    onSelect: handleDelete,
  });

  const actions = (
    <>
      {allowedNext.includes('shortlisted') ? (
        <Button
          variant="secondary"
          iconLeft={Star}
          loading={busy}
          onClick={() => setStatus('shortlisted', 'Bid shortlisted.')}
        >
          Shortlist
        </Button>
      ) : null}
      {allowedNext.includes('awarded') ? (
        <Button
          variant="primary"
          iconLeft={CheckCircle2}
          loading={busy}
          onClick={() => setStatus('awarded', 'Bid awarded.')}
        >
          Award
        </Button>
      ) : null}
      <Button
        variant="secondary"
        iconLeft={Printer}
        onClick={() => window.print()}
      >
        Print
      </Button>
      {current !== 'awarded' && current !== 'rejected' && current !== 'withdrawn' ? (
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
    description: l.notes ? `${l.label} — ${l.notes}` : l.label,
    qty: l.qty,
    rate: l.rate,
    total: (l.qty || 0) * (l.rate || 0),
  }));

  const leadTimes = lines
    .map((l) => l.leadTimeDays)
    .filter((n): n is number => typeof n === 'number');
  const maxLead = leadTimes.length > 0 ? Math.max(...leadTimes) : null;

  const meta: { label: string; value: React.ReactNode }[] = [
    {
      label: 'RFQ',
      value:
        rfqId && rfqLabel ? (
          <a
            href={`${RFQS_PATH}/${encodeURIComponent(rfqId)}`}
            className="text-[var(--st-accent)] hover:underline"
          >
            {rfqLabel}
          </a>
        ) : (
          (rfqLabel ?? '—')
        ),
    },
    { label: 'Submitted', value: formatDocDate(submittedAt ?? '') },
    {
      label: 'Lead time',
      value: maxLead != null ? `${maxLead} days (max)` : '—',
    },
    { label: 'Currency', value: currency },
  ];

  const related: DocRelatedRef[] =
    rfqId && rfqLabel
      ? [
          {
            kind: 'rfq',
            id: rfqId,
            label: rfqLabel,
            href: `${RFQS_PATH}/${encodeURIComponent(rfqId)}`,
            direction: 'parent',
          },
        ]
      : [];

  const subTotal = detailLines.reduce((s, l) => s + l.total, 0);

  return (
    <>
      <DocDetailPage
        backHref={VENDOR_BIDS_PATH}
        backLabel="Vendor bids"
        docNumber={docTitle}
        entitySingular="Vendor bid"
        statuses={BID_STATUSES}
        flow={BID_FLOW}
        status={current}
        actions={actions}
        party={
          vendorLabel
            ? { label: vendorLabel, href: null }
            : null
        }
        meta={meta}
        currency={currency}
        lines={detailLines}
        totals={{ subTotal, total: total || subTotal }}
        terms={terms}
        related={related}
      />

      <BidDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        seed={seed}
        onDone={refresh}
      />
    </>
  );
}
