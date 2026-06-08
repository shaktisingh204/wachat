'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  TBody,
  THead,
  Table,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Td,
  Textarea,
  Th,
  Tr,
  useToast,
} from '@/components/sabcrm/20ui';

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
// `@tanstack/react-virtual`), we render a hard-capped grid. TODO:
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
  const { toast } = useToast();
  const [activeSheetId, setActiveSheetId] = useState<string | null>(props.activeSheetId);
  const [cells, setCells] = useState<SabsheetCellDoc[]>(props.initialCells);
  const [comments, setComments] = useState<SabsheetCommentDoc[]>(props.initialComments);
  const [namedRanges, setNamedRanges] = useState<SabsheetNamedRangeDoc[]>(props.initialNamedRanges);
  const [pivots] = useState<SabsheetPivotTableDoc[]>(props.initialPivots);
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
      // Optimistic local refetch. Re-run server action.
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
        toast.error('Could not save the cell. Please try again.');
      }
    },
    [activeSheetId, props.workbook._id, toast],
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
    toast.success('Formulas recomputed.');
    router.refresh();
  }, [props.workbook._id, router, toast]);

  const onSaveVersion = useCallback(async () => {
    const comment = window.prompt('Version comment (optional)') ?? undefined;
    await saveSabsheetVersion(props.workbook._id, comment);
    toast.success('Version saved.');
    router.refresh();
  }, [props.workbook._id, router, toast]);

  // ---- Render -----------------------------------------------------------
  return (
    <div className="20ui flex h-full flex-col">
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
          toast({ title: 'Formula result', description: `= ${res.display}`, tone: 'info' });
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
          <div className="flex items-center gap-1 border-t border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 py-1">
            {props.sheets.map((s) => (
              <Link
                key={s._id}
                href={`/dashboard/sabsheet/${props.workbook._id}/sheets/${s._id}`}
                className={`rounded-[var(--st-radius)] px-3 py-1 text-xs ${
                  s._id === activeSheetId
                    ? 'bg-[var(--st-bg)] font-medium shadow-sm text-[var(--st-text)]'
                    : 'text-[var(--st-text-secondary)] hover:bg-[var(--st-bg)]'
                }`}
              >
                {s.name}
              </Link>
            ))}
            <Button variant="ghost" size="sm" iconLeft={Plus} onClick={onAddSheet}>
              Add sheet
            </Button>
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
  const router = useRouter();
  return (
    <div className="flex items-center gap-2 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2">
      <Link href="/dashboard/sabsheet" className="text-sm text-[var(--st-text-secondary)] hover:underline">
        SabSheet
      </Link>
      <span className="text-sm text-[var(--st-text-secondary)]">/</span>
      <span className="text-sm font-medium text-[var(--st-text)]">{workbookTitle}</span>
      <div className="ml-auto flex items-center gap-1">
        {/* TODO: implement number-format, font, bg/color, borders, freeze in a follow-up. */}
        <Button variant="ghost" size="sm" disabled title="Bold formatting (coming soon)">
          B
        </Button>
        <Button variant="ghost" size="sm" disabled title="Italic formatting (coming soon)">
          I
        </Button>
        <Button variant="ghost" size="sm" disabled title="Number format (coming soon)">
          123
        </Button>
        <Button variant="ghost" size="sm" disabled title="Borders (coming soon)">
          Borders
        </Button>
        <Button variant="ghost" size="sm" disabled title="Freeze panes (coming soon)">
          Freeze
        </Button>
        <Button variant="outline" size="sm" onClick={onRecompute}>
          Recompute
        </Button>
        <Button variant="outline" size="sm" onClick={onSaveVersion}>
          Save version
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/dashboard/sabsheet/${workbookId}/history`)}
        >
          History
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
    <div className="flex items-center gap-2 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-1">
      <div className="w-16 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] px-2 py-1 text-center font-mono text-xs text-[var(--st-text)]">
        {addr}
      </div>
      <span className="font-mono text-sm text-[var(--st-text-secondary)]">fx</span>
      <Field className="flex-1" label="Formula or value">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCommit();
          }}
          placeholder="Enter a value or =FORMULA(...)"
        />
      </Field>
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
      <Table density="compact" hover={false} stickyHeader className="w-full text-sm">
        <THead>
          <Tr>
            <Th className="w-10 text-xs text-[var(--st-text-secondary)]" aria-label="Row numbers" />
            {Array.from({ length: VIEW_COLS }).map((_, c) => (
              <Th
                key={c}
                align="center"
                className="min-w-[88px] text-xs font-medium text-[var(--st-text-secondary)]"
              >
                {colLabel(c)}
              </Th>
            ))}
          </Tr>
        </THead>
        <TBody>
          {Array.from({ length: VIEW_ROWS }).map((_, row) => (
            <Tr key={row}>
              <Th
                scope="row"
                align="center"
                className="bg-[var(--st-bg-secondary)] text-xs text-[var(--st-text-secondary)]"
              >
                {row + 1}
              </Th>
              {Array.from({ length: VIEW_COLS }).map((_, col) => {
                const c = cells.get(cellKey(row, col));
                const isSel = row === selection.row && col === selection.col;
                const isEditing =
                  editing && editing.row === row && editing.col === col;
                const peers = Object.values(presence).filter(
                  (p) => p.selection.row === row && p.selection.col === col,
                );
                return (
                  <Td
                    key={col}
                    onClick={() => onSelect(row, col)}
                    onDoubleClick={() => onStartEdit(row, col)}
                    className={`relative cursor-cell align-top text-xs ${
                      isSel ? 'outline outline-2 outline-[var(--st-accent)]' : ''
                    }`}
                  >
                    {isEditing ? (
                      <Input
                        inputSize="sm"
                        autoFocus
                        aria-label={`Edit cell ${a1(row, col)}`}
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
                        className="w-full"
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
                  </Td>
                );
              })}
            </Tr>
          ))}
        </TBody>
      </Table>
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
    <aside className="w-72 shrink-0 border-l border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
      <Tabs defaultValue="comments" className="flex h-full flex-col">
        <TabsList className="m-2">
          <TabsTrigger value="comments">Comments</TabsTrigger>
          <TabsTrigger value="named">Named</TabsTrigger>
          <TabsTrigger value="pivots">Pivots</TabsTrigger>
        </TabsList>

        <TabsContent value="comments" className="min-h-0 flex-1 space-y-3 overflow-auto p-3">
          <Card padding="sm" className="space-y-2 text-xs">
            <div className="text-[var(--st-text-secondary)]">
              On {a1(selection.row, selection.col)}
            </div>
            <Field label="New comment">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                rows={2}
              />
            </Field>
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
                // Best-effort optimistic insert. Server has authoritative copy.
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
          </Card>
          <ul className="space-y-2">
            {comments.map((c) => (
              <li key={c._id}>
                <Card padding="sm" className="text-xs">
                  <div className="flex items-center gap-2 font-mono text-[10px] text-[var(--st-text-secondary)]">
                    <span>{a1(c.row, c.col)}</span>
                    <Badge tone={c.resolved ? 'success' : 'warning'} kind="soft">
                      {c.resolved ? 'resolved' : 'open'}
                    </Badge>
                  </div>
                  <div className="mt-1 text-[var(--st-text)]">{c.body}</div>
                  {!c.resolved ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-1"
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
                </Card>
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="named" className="min-h-0 flex-1 space-y-2 overflow-auto p-3">
          <Card padding="sm" className="space-y-2 text-xs">
            <Field label="Range name">
              <Input
                value={rangeName}
                onChange={(e) => setRangeName(e.target.value)}
                placeholder="MY_RANGE"
              />
            </Field>
            <Button
              size="sm"
              iconLeft={Plus}
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
              Add range
            </Button>
          </Card>
          <ul className="space-y-1">
            {namedRanges.map((r) => (
              <li key={r._id}>
                <Card padding="sm" className="text-xs">
                  <div className="font-medium text-[var(--st-text)]">{r.name}</div>
                  <div className="text-[10px] text-[var(--st-text-secondary)]">
                    {a1(r.startRow, r.startCol)}:{a1(r.endRow, r.endCol)}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="pivots" className="min-h-0 flex-1 space-y-2 overflow-auto p-3">
          {/* TODO: pivot table builder UI. The Rust crate stores the config
              JSON; rendering / aggregation is a follow-up. */}
          {pivots.length === 0 ? (
            <EmptyState
              size="sm"
              title="No pivots yet"
              description="The pivot table builder is a follow-up."
            />
          ) : (
            <ul className="space-y-1">
              {pivots.map((p) => (
                <li key={p._id}>
                  <Card padding="sm" className="text-xs">
                    <div className="font-medium text-[var(--st-text)]">{p.name}</div>
                    <div className="text-[10px] text-[var(--st-text-secondary)]">{p.sourceRange}</div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </aside>
  );
}
