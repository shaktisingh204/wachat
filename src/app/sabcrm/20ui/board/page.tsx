'use client';

/**
 * /sabcrm/20ui/board — RecordBoard QA showcase.
 *
 * Renders the RecordSurface kanban composite against ~40 deterministic fake
 * deals across 5 stages, proving:
 *
 *   1. Drag-and-drop — move cards between/within columns (pointer), or focus
 *      a card and use Space (pick up / drop) + arrows (move) + Escape
 *      (cancel). Enter opens the card.
 *   2. Stage gates — dropping a deal WITHOUT a signed contract into "Won"
 *      snaps back and raises the required-fields banner under the Won
 *      header. Dragging a Won deal back out demands approval (banner on the
 *      target column).
 *   3. Deal rotting — open-stage deals idle > 3 days decay: subtle
 *      desaturation, a clock chip past ~15 idle days, and a warn border tint
 *      near 30.
 *   4. Aggregates — header sum per column + weighted-pipeline column footers.
 *   5. Quick add — "+" in a column header appends a fresh deal there.
 */

import * as React from 'react';

import type { CrmRecord } from '@/lib/sabcrm/types';
import {
  RecordBoard,
  type RecordBoardColumn,
  type RecordBoardGateVerdict,
  type RecordBoardRotting,
} from '@/components/sabcrm/20ui/composites/record';
import { Badge } from '@/components/sabcrm/20ui/badge';

/* ----------------------------------------------------------- fake schema */

interface StageDef {
  id: string;
  label: string;
  color: string;
  /** Win probability — drives the weighted-sum column footer. */
  probability: number;
}

const STAGES: StageDef[] = [
  { id: 'inbound', label: 'Inbound', color: '#6b7cf5', probability: 0.1 },
  { id: 'qualified', label: 'Qualified', color: '#0ea5e9', probability: 0.3 },
  { id: 'proposal', label: 'Proposal', color: '#e0974a', probability: 0.6 },
  { id: 'won', label: 'Won', color: '#2f9e6e', probability: 1 },
  { id: 'lost', label: 'Lost', color: '#e5484d', probability: 0 },
];

/* ------------------------------------------------------------- fake data */

/** Deterministic PRNG (mulberry32) — same 40 deals on every load. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAME_A = ['Acme', 'Globex', 'Initech', 'Umbra', 'Hooli', 'Vandelay', 'Stark', 'Wayne', 'Aperture', 'Tyrell'];
const NAME_B = ['renewal', 'expansion', 'pilot', 'migration', 'rollout', 'upgrade', 'license', 'platform deal'];
const OWNERS = ['Asha', 'Ravi', 'Meera', 'Dev', 'Priya', 'Kabir'];

function makeDeals(count: number): CrmRecord[] {
  const rand = mulberry32(7);
  const out: CrmRecord[] = [];
  for (let i = 0; i < count; i++) {
    const stage = STAGES[Math.floor(rand() * STAGES.length)].id;
    out.push({
      _id: `deal_${i + 1}`,
      object: 'deals',
      userId: 'demo-user',
      data: {
        name: `${NAME_A[Math.floor(rand() * NAME_A.length)]} ${NAME_B[Math.floor(rand() * NAME_B.length)]}`,
        amount: Math.round(rand() * 88 + 2) * 1000,
        owner: OWNERS[Math.floor(rand() * OWNERS.length)],
        stage,
        // ~half the pipeline is missing the contract → Won gate demo.
        contract: rand() > 0.5,
        idleDays: Math.floor(rand() * 42),
      },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
  }
  return out;
}

const currencyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

/* ------------------------------------------------------------------ page */

export default function RecordBoardShowcasePage(): React.JSX.Element {
  const [records, setRecords] = React.useState<CrmRecord[]>(() => makeDeals(40));
  const [lastEvent, setLastEvent] = React.useState<string | null>(null);
  const addNonce = React.useRef(0);

  /* ---- columns (header sums recompute as deals move) ---- */
  const columns = React.useMemo<RecordBoardColumn[]>(
    () =>
      STAGES.map((stage) => {
        const sum = records
          .filter((r) => r.data.stage === stage.id)
          .reduce((acc, r) => acc + Number(r.data.amount ?? 0), 0);
        return {
          id: stage.id,
          label: stage.label,
          color: stage.color,
          meta: { sumLabel: currencyFmt.format(sum) },
        };
      }),
    [records],
  );

  /* ---- stage gates ---- */
  const canMove = React.useCallback(
    (record: CrmRecord, toColumnId: string): RecordBoardGateVerdict => {
      if (toColumnId === 'won' && record.data.contract !== true) {
        return {
          ok: false,
          kind: 'required-fields',
          reason:
            'Stage gate: "Signed contract" is required before a deal can enter Won.',
        };
      }
      if (record.data.stage === 'won' && toColumnId !== 'won') {
        return {
          ok: false,
          kind: 'approval',
          reason: 'Reopening a won deal needs manager approval.',
        };
      }
      return { ok: true };
    },
    [],
  );

  /* ---- deal rotting (idle days → 0..1 over a 30-day window) ---- */
  const rotting = React.useCallback(
    (record: CrmRecord): RecordBoardRotting | null => {
      const stage = String(record.data.stage ?? '');
      if (stage === 'won' || stage === 'lost') return null;
      const idle = Number(record.data.idleDays ?? 0);
      if (idle <= 3) return null;
      return { level: Math.min(idle / 30, 1), label: `${idle}d idle` };
    },
    [],
  );

  /* ---- optimistic move → "persist" into local state ---- */
  const handleMove = React.useCallback(
    (recordId: string, toColumnId: string, toIndex: number) => {
      setRecords((prev) => {
        const moved = prev.find((r) => r._id === recordId);
        if (!moved) return prev;
        const rest = prev.filter((r) => r._id !== recordId);
        const updated: CrmRecord = {
          ...moved,
          data: { ...moved.data, stage: toColumnId, idleDays: 0 },
        };
        // Insert so the record sits at `toIndex` within its new column.
        let seen = 0;
        let insertAt = rest.length;
        for (let i = 0; i < rest.length; i++) {
          if (String(rest[i].data.stage ?? '') === toColumnId) {
            if (seen === toIndex) {
              insertAt = i;
              break;
            }
            seen++;
          }
        }
        const next = [...rest];
        next.splice(insertAt, 0, updated);
        return next;
      });
      setLastEvent(`Moved ${recordId} → ${toColumnId}[${toIndex}]`);
    },
    [],
  );

  const handleAddCard = React.useCallback((columnId: string) => {
    addNonce.current += 1;
    const n = addNonce.current;
    setRecords((prev) => [
      ...prev,
      {
        _id: `deal_new_${n}`,
        object: 'deals',
        userId: 'demo-user',
        data: {
          name: `New deal ${n}`,
          amount: 10000,
          owner: 'You',
          stage: columnId,
          contract: false,
          idleDays: 0,
        },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    setLastEvent(`Added "New deal ${n}" to ${columnId}`);
  }, []);

  const handleCardClick = React.useCallback((record: CrmRecord) => {
    setLastEvent(`Opened ${String(record.data.name ?? record._id)}`);
  }, []);

  /* ---- weighted-sum column footers ---- */
  const columnFooter = React.useCallback(
    (column: RecordBoardColumn): React.ReactNode => {
      const stage = STAGES.find((s) => s.id === column.id);
      if (!stage) return null;
      const sum = records
        .filter((r) => r.data.stage === column.id)
        .reduce((acc, r) => acc + Number(r.data.amount ?? 0), 0);
      return (
        <span>
          Weighted {currencyFmt.format(sum * stage.probability)} ·{' '}
          {Math.round(stage.probability * 100)}%
        </span>
      );
    },
    [records],
  );

  /* ---- card renderer ---- */
  const renderCard = React.useCallback(
    (record: CrmRecord): React.ReactNode => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--st-space-1)' }}>
        <span
          style={{
            fontSize: 'var(--st-font-size-sm)',
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {String(record.data.name ?? record._id)}
        </span>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--st-space-2)',
            fontSize: 'var(--st-font-size-xs)',
            color: 'var(--st-text-secondary)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span>{currencyFmt.format(Number(record.data.amount ?? 0))}</span>
          <span>·</span>
          <span>{String(record.data.owner ?? '')}</span>
        </span>
        {record.data.contract === true ? (
          <span>
            <Badge tone="success">Contract signed</Badge>
          </span>
        ) : (
          <span>
            <Badge tone="neutral">No contract</Badge>
          </span>
        )}
      </div>
    ),
    [],
  );

  return (
    <div
      className="20ui"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--st-space-4)',
        padding: 'var(--st-space-5)',
        fontFamily: 'var(--st-font)',
        color: 'var(--st-text)',
      }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
          RecordBoard showcase
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--st-font-size-sm)',
            color: 'var(--st-text-secondary)',
          }}
        >
          40 deterministic deals. QA: drag a &quot;No contract&quot; card into
          Won (gate banner + snap back); drag a Won card out (approval gate);
          watch idle deals desaturate and grow a clock; Space/arrows move a
          focused card, Enter opens it.
        </p>
      </header>

      <div
        style={{
          fontSize: 'var(--st-font-size-sm)',
          color: 'var(--st-text-secondary)',
          minHeight: 20,
        }}
        aria-live="polite"
      >
        {lastEvent ?? 'Interact with the board to see events here.'}
      </div>

      <div style={{ height: 640, display: 'grid', minWidth: 0 }}>
        <RecordBoard
          columns={columns}
          records={records}
          groupKey="stage"
          renderCard={renderCard}
          onMove={handleMove}
          canMove={canMove}
          rotting={rotting}
          onCardClick={handleCardClick}
          columnFooter={columnFooter}
          onAddCard={handleAddCard}
          emptyState={<span>No deals yet — add one with a column&apos;s “+”.</span>}
        />
      </div>
    </div>
  );
}
