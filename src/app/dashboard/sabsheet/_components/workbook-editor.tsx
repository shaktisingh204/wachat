'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { Button } from '@/components/zoruui/button';
import { Input } from '@/components/zoruui/input';
import {
  Tabs,
  ZoruTabsList,
  ZoruTabsTrigger,
  ZoruTabsContent,
} from '@/components/zoruui';

import {
  addSabsheetComment,
  createSabsheetNamedRange,
  createSabsheetSheet,
  evaluateSabsheetFormula,
  recomputeSabsheetFormulas,
  resolveSabsheetComment,
  saveSabsheetVersion,
  setSabsheetCell,
} from '@/app/actions/sabsheet.actions';

import type { SabsheetWorkbookDoc } from '@/lib/rust-client/sabsheet-workbooks';
import type { SabsheetSheetDoc } from '@/lib/rust-client/sabsheet-sheets';
import type { SabsheetCellDoc } from '@/lib/rust-client/sabsheet-cells';
import type { SabsheetCommentDoc } from '@/lib/rust-client/sabsheet-comments';
import type { SabsheetNamedRangeDoc } from '@/lib/rust-client/sabsheet-named-ranges';
import type { SabsheetPivotTableDoc } from '@/lib/rust-client/sabsheet-pivot-tables';
import {
  getDefaultSheetTransport,
  type ISheetTransport,
  type SabsheetPresenceEvent,
} from '@/lib/sabsheet/transport';

// --- Grid sizing -----------------------------------------------------------
// Until we wire a virtualization library (`react-window` or
// `@tanstack/react-virtual`), we render a hard-capped <table>. TODO:
// virtualize so larger sheets are usable.
const VIEW_ROWS = 100;
const VIEW_COLS = 26;

function colLabel(c: number): string {
  let n = c;
  let s = '';
  do {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

function a1(row: number, col: number): string {
  return `${colLabel(col)}${row + 1}`;
}

function cellKey(row: number, col: number): string {
  return `${row}:${col}`;
}

function indexCells(cells: SabsheetCellDoc[]): Map<string, SabsheetCellDoc> {
  const m = new Map<string, SabsheetCellDoc>();
  for (const c of cells) m.set(cellKey(c.row, c.col), c);
  return m;
}

function displayValue(cell: SabsheetCellDoc | undefined): string {
  if (!cell) return '';
  if (cell.value == null) return '';
  if (typeof cell.value === 'boolean') return cell.value ? 'TRUE' : 'FALSE';
  return String(cell.value);
}

function colorFromUserId(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 70% 55%)`;
}

interface Props {
  workbook: SabsheetWorkbookDoc;
  sheets: SabsheetSheetDoc[];
  activeSheetId: string | null;
  initialCells: SabsheetCellDoc[];
  initialComments: SabsheetCommentDoc[];
  initialNamedRanges: SabsheetNamedRangeDoc[];
  initialPivots: SabsheetPivotTableDoc[];
}

export function WorkbookEditor(props: Props) {
  const router = useRouter();
  const [activeSheetId, setActiveSheetId] = useState<string | null>(props.activeSheetId);
  const [cells, setCells] = useState<SabsheetCellDoc[]>(props.initialCells);
  const [comments, setComments] = useState<SabsheetCommentDoc[]>(props.initialComments);
  const [namedRanges, setNamedRanges] = useState<SabsheetNamedRangeDoc[]>(props.initialNamedRanges);
  const [pivots, setPivots] = useState<SabsheetPivotTableDoc[]>(props.initialPivots);
  const [selection, setSelection] = useState<{ row: number; col: number }>({ row: 0, col: 0 });
  const [editing, setEditing] = useState<{ row: number; col: number; value: string } | null>(null);
  const [formulaInput, setFormulaInput] = useState('');
  const [, startTransition] = useTransition();
  const [presence, setPresence] = useState<Record<string, SabsheetPresenceEvent>>({});
  const transportRef = useRef<ISheetTransport | null>(null);

  const indexed = useMemo(() => indexCells(cells), [cells]);

  // Wire transport.
  useEffect(() => {
    const t = getDefaultSheetTransport();
    transportRef.current = t;
    t.connect(props.workbook._id);
    const offEdits = t.subscribeCellEdits((e) => {
      if (e.sheetId !== activeSheetId) return;
      // Optimistic local refetch — re-run server action.
      startTransition(() => router.refresh());
    });
    const offPresence = t.subscribePresence((e) => {
      if (e.sheetId !== activeSheetId) return;
      setPresence((p) => ({ ...p, [e.userId]: e }));
    });
    return () => {
      offEdits();
      offPresence();
      t.disconnect();
    };
  }, [props.workbook._id, activeSheetId, router]);

  // Keep the formula bar in sync with the active cell.
  useEffect(() => {
    const c = indexed.get(cellKey(selection.row, selection.col));
    setFormulaInput(c?.formula ? `=${c.formula}` : displayValue(c));
  }, [selection, indexed]);

  const onSelect = useCallback(
    (row: number, col: number) => {
      setSelection({ row, col });
      const t = transportRef.current;
      if (t && activeSheetId) {
        t.setSelection({
          workbookId: props.workbook._id,
          sheetId: activeSheetId,
          userId: 'me',
          selection: { row, col, anchorRow: row, anchorCol: col },
          color: '#3aa3ff',
          ts: new Date().toISOString(),
        });
      }
    },
    [activeSheetId, props.workbook._id],
  );

  const commitEdit = useCallback(
    async (row: number, col: number, raw: string) => {
      if (!activeSheetId) return;
      try {
        const updated = await setSabsheetCell(activeSheetId, row, col, raw);
        setCells((prev) => {
          const idx = prev.findIndex((c) => c._id === updated._id);
          if (idx >= 0) {
            const next = prev.slice();
            next[idx] = updated;
            return next;
          }
          return [...prev, updated];
        });
        transportRef.current?.sendCellEdit({
          workbookId: props.workbook._id,
          sheetId: activeSheetId,
          row,
          col,
          valueOrFormula: raw,
          userId: 'me',
          ts: new Date().toISOString(),
        });
      } catch (e) {
        console.error('setSabsheetCell failed', e);
      }
    },
    [activeSheetId, props.workbook._id],
  );

  const onAddSheet = useCallback(async () => {
    const sheet = await createSabsheetSheet({
      workbookId: props.workbook._id,
      name: `Sheet${props.sheets.length + 1}`,
      position: props.sheets.length,
    });
    setActiveSheetId(sheet._id);
    router.refresh();
  }, [props.sheets.length, props.workbook._id, router]);

  const onRecompute = useCallback(async () => {
    await recomputeSabsheetFormulas(props.workbook._id);
    router.refresh();
  }, [props.workbook._id, router]);

  const onSaveVersion = useCallback(async () => {
    const comment = window.prompt('Version comment (optional)') ?? undefined;
    await saveSabsheetVersion(props.workbook._id, comment);
    router.refresh();
  }, [props.workbook._id, router]);

  // ---- Render -----------------------------------------------------------
  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <Toolbar
        workbookTitle={props.workbook.title}
        workbookId={props.workbook._id}
        onRecompute={onRecompute}
        onSaveVersion={onSaveVersion}
      />

      {/* Formula bar */}
      <FormulaBar
        addr={a1(selection.row, selection.col)}
        value={formulaInput}
        onChange={setFormulaInput}
        onCommit={() => commitEdit(selection.row, selection.col, formulaInput)}
        onEvaluate={async () => {
          const res = await evaluateSabsheetFormula(props.workbook._id, formulaInput);
          window.alert(`= ${res.display}`);
        }}
      />

      <div className="flex min-h-0 flex-1">
        {/* Grid */}
        <div className="flex min-w-0 flex-1 flex-col">
          <GridSurface
            cells={indexed}
            selection={selection}
            presence={presence}
            editing={editing}
            onSelect={onSelect}
            onStartEdit={(row, col) => {
              const c = indexed.get(cellKey(row, col));
              setEditing({ row, col, value: c?.formula ? `=${c.formula}` : displayValue(c) });
            }}
            onEditingChange={(value) =>
              setEditing((e) => (e ? { ...e, value } : e))
            }
            onCommit={() => {
              if (editing) {
                void commitEdit(editing.row, editing.col, editing.value);
                setEditing(null);
              }
            }}
            onCancelEdit={() => setEditing(null)}
          />

          {/* Sheet tabs */}
          <div className="flex items-center gap-1 border-t bg-zoru-surface-2/40 px-2 py-1">
            {props.sheets.map((s) => (
              <Link
                key={s._id}
                href={`/dashboard/sabsheet/${props.workbook._id}/sheets/${s._id}`}
                className={`rounded px-3 py-1 text-xs ${
                  s._id === activeSheetId
                    ? 'bg-zoru-surface font-medium shadow-sm'
                    : 'text-zoru-ink-muted hover:bg-zoru-surface/60'
                }`}
              >
                {s.name}
              </Link>
            ))}
            <button
              type="button"
              onClick={onAddSheet}
              className="rounded px-2 py-1 text-xs text-zoru-ink-muted hover:bg-zoru-surface/60"
            >
              + Add sheet
            </button>
          </div>
        </div>

        {/* Side panels */}
        <SidePanels
          workbookId={props.workbook._id}
          activeSheetId={activeSheetId}
          selection={selection}
          comments={comments}
          namedRanges={namedRanges}
          pivots={pivots}
          onCommentsChange={setComments}
          onNamedRangesChange={setNamedRanges}
        />
      </div>
    </div>
  );
}

// ===========================================================================
// Sub-components
// ===========================================================================

function Toolbar({
  workbookTitle,
  workbookId,
  onRecompute,
  onSaveVersion,
}: {
  workbookTitle: string;
  workbookId: string;
  onRecompute: () => void;
  onSaveVersion: () => void;
}) {
  return (
    <div className="flex items-center gap-2 border-b bg-zoru-surface px-3 py-2">
      <Link href="/dashboard/sabsheet" className="text-sm text-zoru-ink-muted hover:underline">
        SabSheet
      </Link>
      <span className="text-sm text-zoru-ink-muted">/</span>
      <span className="text-sm font-medium">{workbookTitle}</span>
      <div className="ml-auto flex items-center gap-1">
        {/* TODO: implement number-format, font, bg/color, borders, freeze in a follow-up. */}
        <Button variant="ghost" size="sm" disabled title="TODO: bold formatting">
          B
        </Button>
        <Button variant="ghost" size="sm" disabled title="TODO: italic formatting">
          I
        </Button>
        <Button variant="ghost" size="sm" disabled title="TODO: number format">
          123
        </Button>
        <Button variant="ghost" size="sm" disabled title="TODO: borders">
          ▦
        </Button>
        <Button variant="ghost" size="sm" disabled title="TODO: freeze panes">
          Freeze
        </Button>
        <Button variant="outline" size="sm" onClick={onRecompute}>
          Recompute
        </Button>
        <Button variant="outline" size="sm" onClick={onSaveVersion}>
          Save version
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/sabsheet/${workbookId}/history`}>History</Link>
        </Button>
      </div>
    </div>
  );
}

function FormulaBar({
  addr,
  value,
  onChange,
  onCommit,
  onEvaluate,
}: {
  addr: string;
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onEvaluate: () => void;
}) {
  return (
    <div className="flex items-center gap-2 border-b bg-zoru-surface px-3 py-1">
      <div className="w-16 rounded border bg-zoru-surface-2/40 px-2 py-1 text-center font-mono text-xs">
        {addr}
      </div>
      <span className="font-mono text-sm text-zoru-ink-muted">fx</span>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onCommit();
        }}
        className="flex-1"
        placeholder="Enter a value or =FORMULA(…)"
      />
      <Button variant="ghost" size="sm" onClick={onEvaluate}>
        Evaluate
      </Button>
    </div>
  );
}

function GridSurface({
  cells,
  selection,
  presence,
  editing,
  onSelect,
  onStartEdit,
  onEditingChange,
  onCommit,
  onCancelEdit,
}: {
  cells: Map<string, SabsheetCellDoc>;
  selection: { row: number; col: number };
  presence: Record<string, SabsheetPresenceEvent>;
  editing: { row: number; col: number; value: string } | null;
  onSelect: (row: number, col: number) => void;
  onStartEdit: (row: number, col: number) => void;
  onEditingChange: (value: string) => void;
  onCommit: () => void;
  onCancelEdit: () => void;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-zoru-surface-2/60">
          <tr>
            <th className="w-10 border bg-zoru-surface-2/80 px-1 text-xs text-zoru-ink-muted" />
            {Array.from({ length: VIEW_COLS }).map((_, c) => (
              <th
                key={c}
                className="min-w-[88px] border bg-zoru-surface-2/80 px-2 py-1 text-xs font-medium text-zoru-ink-muted"
              >
                {colLabel(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: VIEW_ROWS }).map((_, row) => (
            <tr key={row}>
              <th
                scope="row"
                className="border bg-zoru-surface-2/60 px-1 text-center text-xs text-zoru-ink-muted"
              >
                {row + 1}
              </th>
              {Array.from({ length: VIEW_COLS }).map((_, col) => {
                const c = cells.get(cellKey(row, col));
                const isSel = row === selection.row && col === selection.col;
                const isEditing =
                  editing && editing.row === row && editing.col === col;
                const peers = Object.values(presence).filter(
                  (p) => p.selection.row === row && p.selection.col === col,
                );
                return (
                  <td
                    key={col}
                    onClick={() => onSelect(row, col)}
                    onDoubleClick={() => onStartEdit(row, col)}
                    className={`relative cursor-cell border px-2 py-1 align-top text-xs ${
                      isSel ? 'outline outline-2 outline-primary' : ''
                    }`}
                  >
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editing!.value}
                        onChange={(e) => onEditingChange(e.target.value)}
                        onBlur={onCommit}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            onCommit();
                          } else if (e.key === 'Escape') {
                            onCancelEdit();
                          }
                        }}
                        className="w-full bg-zoru-surface outline-none"
                      />
                    ) : (
                      <span>{displayValue(c)}</span>
                    )}
                    {peers.map((p) => (
                      <span
                        key={p.userId}
                        title={p.userId}
                        className="absolute right-0.5 top-0.5 inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: p.color ?? colorFromUserId(p.userId) }}
                      />
                    ))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SidePanels({
  workbookId,
  activeSheetId,
  selection,
  comments,
  namedRanges,
  pivots,
  onCommentsChange,
  onNamedRangesChange,
}: {
  workbookId: string;
  activeSheetId: string | null;
  selection: { row: number; col: number };
  comments: SabsheetCommentDoc[];
  namedRanges: SabsheetNamedRangeDoc[];
  pivots: SabsheetPivotTableDoc[];
  onCommentsChange: (next: SabsheetCommentDoc[]) => void;
  onNamedRangesChange: (next: SabsheetNamedRangeDoc[]) => void;
}) {
  const [newComment, setNewComment] = useState('');
  const [rangeName, setRangeName] = useState('');

  return (
    <aside className="w-72 shrink-0 border-l bg-zoru-surface-2/20">
      <Tabs defaultValue="comments" className="flex h-full flex-col">
        <ZoruTabsList className="m-2">
          <ZoruTabsTrigger value="comments">Comments</ZoruTabsTrigger>
          <ZoruTabsTrigger value="named">Named</ZoruTabsTrigger>
          <ZoruTabsTrigger value="pivots">Pivots</ZoruTabsTrigger>
        </ZoruTabsList>

        <ZoruTabsContent value="comments" className="min-h-0 flex-1 space-y-3 overflow-auto p-3">
          <div className="space-y-2 rounded-md border bg-zoru-surface p-2 text-xs">
            <div className="text-zoru-ink-muted">
              On {a1(selection.row, selection.col)}
            </div>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment…"
              className="w-full rounded border bg-zoru-surface p-2 text-xs"
              rows={2}
            />
            <Button
              size="sm"
              disabled={!newComment.trim() || !activeSheetId}
              onClick={async () => {
                if (!activeSheetId) return;
                const body = newComment.trim();
                if (!body) return;
                await addSabsheetComment({
                  workbookId,
                  sheetId: activeSheetId,
                  row: selection.row,
                  col: selection.col,
                  body,
                });
                setNewComment('');
                // Best-effort optimistic insert — server has authoritative
                // copy.
                onCommentsChange([
                  ...comments,
                  {
                    _id: `tmp-${Date.now()}`,
                    workbookId,
                    ownerUserId: 'me',
                    sheetId: activeSheetId,
                    authorUserId: 'me',
                    row: selection.row,
                    col: selection.col,
                    body,
                    resolved: false,
                  },
                ]);
              }}
            >
              Add comment
            </Button>
          </div>
          <ul className="space-y-2">
            {comments.map((c) => (
              <li key={c._id} className="rounded-md border bg-zoru-surface p-2 text-xs">
                <div className="font-mono text-[10px] text-zoru-ink-muted">
                  {a1(c.row, c.col)} · {c.resolved ? 'resolved' : 'open'}
                </div>
                <div className="mt-1">{c.body}</div>
                {!c.resolved ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-1 h-7 text-xs"
                    onClick={async () => {
                      await resolveSabsheetComment(c._id);
                      onCommentsChange(
                        comments.map((x) =>
                          x._id === c._id ? { ...x, resolved: true } : x,
                        ),
                      );
                    }}
                  >
                    Resolve
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </ZoruTabsContent>

        <ZoruTabsContent value="named" className="min-h-0 flex-1 space-y-2 overflow-auto p-3">
          <div className="space-y-2 rounded-md border bg-zoru-surface p-2 text-xs">
            <Input
              value={rangeName}
              onChange={(e) => setRangeName(e.target.value)}
              placeholder="MY_RANGE"
            />
            <Button
              size="sm"
              disabled={!rangeName.trim() || !activeSheetId}
              onClick={async () => {
                if (!activeSheetId) return;
                const r = await createSabsheetNamedRange({
                  workbookId,
                  name: rangeName.trim(),
                  sheetId: activeSheetId,
                  startRow: selection.row,
                  startCol: selection.col,
                  endRow: selection.row,
                  endCol: selection.col,
                });
                onNamedRangesChange([
                  ...namedRanges,
                  {
                    _id: r.id,
                    workbookId,
                    ownerUserId: 'me',
                    name: rangeName.trim(),
                    sheetId: activeSheetId,
                    startRow: selection.row,
                    startCol: selection.col,
                    endRow: selection.row,
                    endCol: selection.col,
                  },
                ]);
                setRangeName('');
              }}
            >
              + Add range
            </Button>
          </div>
          <ul className="space-y-1">
            {namedRanges.map((r) => (
              <li
                key={r._id}
                className="rounded-md border bg-zoru-surface px-2 py-1 text-xs"
              >
                <div className="font-medium">{r.name}</div>
                <div className="text-[10px] text-zoru-ink-muted">
                  {a1(r.startRow, r.startCol)}:{a1(r.endRow, r.endCol)}
                </div>
              </li>
            ))}
          </ul>
        </ZoruTabsContent>

        <ZoruTabsContent value="pivots" className="min-h-0 flex-1 space-y-2 overflow-auto p-3">
          {/* TODO: pivot table builder UI. The Rust crate stores the config
              JSON; rendering / aggregation is a follow-up. */}
          <ul className="space-y-1">
            {pivots.length === 0 ? (
              <li className="rounded-md border bg-zoru-surface p-3 text-xs text-zoru-ink-muted">
                No pivots yet. Builder UI is a follow-up.
              </li>
            ) : (
              pivots.map((p) => (
                <li
                  key={p._id}
                  className="rounded-md border bg-zoru-surface px-2 py-1 text-xs"
                >
                  <div className="font-medium">{p.name}</div>
                  <div className="text-[10px] text-zoru-ink-muted">{p.sourceRange}</div>
                </li>
              ))
            )}
          </ul>
        </ZoruTabsContent>
      </Tabs>
    </aside>
  );
}
