'use client';

/**
 * /sabcrm/20ui/record-grid — RecordGrid QA showcase.
 *
 * Renders the RecordSurface composites (RecordGrid + BulkBar +
 * GridPagination) against 5,000 deterministic fake CrmRecords, proving:
 *
 *   1. Virtualization — toggle "All rows" and scroll: 5,000 rows stay smooth,
 *      only a window of DOM rows exists (inspect the row count in devtools).
 *   2. Sort — click headers to cycle asc → desc → none (sorts all 5,000).
 *   3. Column resize — drag the hairline between headers (min 80px).
 *   4. Selection — row checkboxes + header select-all (current page) feed
 *      the floating BulkBar.
 *   5. Keyboard nav — Tab to a row, Up/Down to move, Enter opens, Space
 *      toggles selection.
 */

import * as React from 'react';

import type {
  ObjectMetadata,
  FieldMetadata,
  CrmRecord,
} from '@/lib/sabcrm/types';
import {
  RecordGrid,
  BulkBar,
  GridPagination,
  type RecordGridSort,
} from '@/components/sabcrm/20ui/composites/record';
import { Badge } from '@/components/sabcrm/20ui/badge';
import { Button } from '@/components/sabcrm/20ui/button';
import { Switch } from '@/components/sabcrm/20ui/choice';

/* ----------------------------------------------------------- fake schema */

const DEMO_OBJECT: ObjectMetadata = {
  slug: 'companies',
  labelSingular: 'Company',
  labelPlural: 'Companies',
  icon: 'Building2',
  fields: [],
  views: ['table'],
};

const DEMO_FIELDS: FieldMetadata[] = [
  { key: 'name', label: 'Name', type: 'TEXT', isLabel: true, inTable: true },
  { key: 'domain', label: 'Domain', type: 'TEXT', inTable: true },
  { key: 'arr', label: 'ARR', type: 'CURRENCY', inTable: true },
  { key: 'employees', label: 'Employees', type: 'NUMBER', inTable: true },
  {
    key: 'stage',
    label: 'Stage',
    type: 'SELECT',
    inTable: true,
    options: [
      { value: 'lead', label: 'Lead' },
      { value: 'qualified', label: 'Qualified' },
      { value: 'proposal', label: 'Proposal' },
      { value: 'won', label: 'Won' },
      { value: 'lost', label: 'Lost' },
    ],
  },
  { key: 'renewal', label: 'Renewal', type: 'DATE', inTable: true },
  { key: 'active', label: 'Active', type: 'BOOLEAN', inTable: true },
];

const INITIAL_WIDTHS: Record<string, number> = {
  name: 220,
  domain: 180,
  arr: 130,
  employees: 110,
  stage: 130,
  renewal: 140,
  active: 110,
};

/* ------------------------------------------------------------- fake data */

/** Deterministic PRNG (mulberry32) — same 5,000 rows on every load. */
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

const NAME_A = ['Acme', 'Globex', 'Initech', 'Umbra', 'Hooli', 'Vandelay', 'Stark', 'Wayne', 'Aperture', 'Tyrell', 'Cyberdyne', 'Wonka', 'Sirius', 'Massive', 'Pied'];
const NAME_B = ['Labs', 'Systems', 'Industries', 'Dynamics', 'Logistics', 'Networks', 'Robotics', 'Analytics', 'Holdings', 'Software', 'Energy', 'Media', 'Capital', 'Health', 'Foods'];
const STAGES = ['lead', 'qualified', 'proposal', 'won', 'lost'];

function makeRecords(count: number): CrmRecord[] {
  const rand = mulberry32(42);
  const out: CrmRecord[] = [];
  for (let i = 0; i < count; i++) {
    const name = `${NAME_A[Math.floor(rand() * NAME_A.length)]} ${NAME_B[Math.floor(rand() * NAME_B.length)]} ${i + 1}`;
    const renewal = new Date(
      Date.UTC(2026, Math.floor(rand() * 12), 1 + Math.floor(rand() * 28)),
    ).toISOString();
    out.push({
      _id: `rec_${i + 1}`,
      object: 'companies',
      userId: 'demo-user',
      data: {
        name,
        domain: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '')}.com`,
        arr: Math.round(rand() * 990 + 10) * 1000,
        employees: Math.floor(rand() * 4990) + 10,
        stage: STAGES[Math.floor(rand() * STAGES.length)],
        renewal,
        active: rand() > 0.3,
      },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
  }
  return out;
}

/* ---------------------------------------------------------- cell renderer */

const currencyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const dateFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const STAGE_TONE: Record<string, 'info' | 'accent' | 'warning' | 'success' | 'danger'> = {
  lead: 'info',
  qualified: 'accent',
  proposal: 'warning',
  won: 'success',
  lost: 'danger',
};

function renderDemoCell(
  record: CrmRecord,
  field: FieldMetadata,
): React.ReactNode {
  const value = record.data[field.key];
  if (value == null || value === '') {
    return <span style={{ color: 'var(--st-text-tertiary)' }}>&ndash;</span>;
  }
  switch (field.type) {
    case 'NUMBER':
      return (value as number).toLocaleString();
    case 'CURRENCY':
      return currencyFmt.format(value as number);
    case 'SELECT': {
      const opt = field.options?.find((o) => o.value === value);
      return (
        <Badge tone={STAGE_TONE[String(value)] ?? 'neutral'}>
          {opt?.label ?? String(value)}
        </Badge>
      );
    }
    case 'DATE':
      return dateFmt.format(new Date(value as string));
    case 'BOOLEAN':
      return value ? (
        <Badge tone="success" dot>
          Active
        </Badge>
      ) : (
        <Badge tone="neutral">Inactive</Badge>
      );
    default:
      return String(value);
  }
}

/* ------------------------------------------------------------------ page */

export default function RecordGridShowcasePage(): React.JSX.Element {
  const records = React.useMemo(() => makeRecords(5000), []);

  const [sort, setSort] = React.useState<RecordGridSort | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(
    () => new Set(),
  );
  const [columnWidths, setColumnWidths] =
    React.useState<Record<string, number>>(INITIAL_WIDTHS);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(50);
  const [allRows, setAllRows] = React.useState(false);
  const [lastOpened, setLastOpened] = React.useState<string | null>(null);

  const sorted = React.useMemo(() => {
    if (!sort) return records;
    const dir = sort.dir === 'asc' ? 1 : -1;
    const key = sort.key;
    return records
      .map((r, i) => ({ r, i }))
      .sort((a, b) => {
        const av = a.r.data[key];
        const bv = b.r.data[key];
        let cmp: number;
        if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
        else if (typeof av === 'boolean' && typeof bv === 'boolean')
          cmp = av === bv ? 0 : av ? -1 : 1;
        else
          cmp = String(av ?? '').localeCompare(String(bv ?? ''), undefined, {
            numeric: true,
            sensitivity: 'base',
          });
        return cmp !== 0 ? cmp * dir : a.i - b.i;
      })
      .map((d) => d.r);
  }, [records, sort]);

  const pageRecords = React.useMemo(
    () => (allRows ? sorted : sorted.slice((page - 1) * pageSize, page * pageSize)),
    [sorted, allRows, page, pageSize],
  );

  const handleColumnResize = React.useCallback((key: string, px: number) => {
    setColumnWidths((prev) => ({ ...prev, [key]: px }));
  }, []);

  const handleRowClick = React.useCallback((record: CrmRecord) => {
    setLastOpened(String(record.data.name ?? record._id));
  }, []);

  const handlePageSizeChange = React.useCallback((size: number) => {
    setPageSize(size);
    setPage(1);
  }, []);

  const clearSelection = React.useCallback(() => setSelected(new Set()), []);

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
          RecordGrid showcase
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--st-font-size-sm)',
            color: 'var(--st-text-secondary)',
          }}
        >
          5,000 deterministic records. QA: sort headers, drag column edges to
          resize, select-all, then Tab into a row and use Up/Down, Enter
          (open) and Space (select).
        </p>
      </header>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--st-space-4)',
          fontSize: 'var(--st-font-size-sm)',
        }}
      >
        <Switch
          checked={allRows}
          onCheckedChange={setAllRows}
          label="All 5,000 rows (proves virtualization)"
        />
        <span style={{ color: 'var(--st-text-secondary)' }} aria-live="polite">
          {lastOpened
            ? `Opened: ${lastOpened}`
            : 'Click a row (or press Enter on it) to open it.'}
        </span>
      </div>

      <div style={{ height: 600, display: 'grid', minWidth: 0 }}>
        <RecordGrid
          object={DEMO_OBJECT}
          fields={DEMO_FIELDS}
          records={pageRecords}
          total={sorted.length}
          renderCell={renderDemoCell}
          onRowClick={handleRowClick}
          selection={{ selected, onChange: setSelected }}
          sort={sort}
          onSortChange={setSort}
          columnWidths={columnWidths}
          onColumnResize={handleColumnResize}
          footer={
            allRows ? (
              <div
                style={{
                  padding: 'var(--st-space-2) var(--st-space-3)',
                  fontSize: 'var(--st-font-size-sm)',
                  color: 'var(--st-text-secondary)',
                }}
              >
                Showing all {sorted.length.toLocaleString()} rows (virtualized)
              </div>
            ) : (
              <GridPagination
                page={page}
                pageSize={pageSize}
                total={sorted.length}
                onPageChange={setPage}
                onPageSizeChange={handlePageSizeChange}
              />
            )
          }
        />
      </div>

      <BulkBar count={selected.size} onClear={clearSelection}>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            console.info('[record-grid demo] export', [...selected]);
          }}
        >
          Export
        </Button>
        <Button
          size="sm"
          variant="danger"
          onClick={() => {
            console.info('[record-grid demo] delete', [...selected]);
            clearSelection();
          }}
        >
          Delete
        </Button>
      </BulkBar>
    </div>
  );
}
