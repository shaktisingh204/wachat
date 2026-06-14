'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Copy, Filter as FilterIcon, Pencil, Plus, Save, Share2, Trash2, X } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Input,
  Label,
  PageActions,
  PageDescription,
  PageEyebrow,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
} from '@/components/sabcrm/20ui';
import { shareBoardAction, updateBoardAction } from '@/app/actions/sabbi-boards.actions';
import { runMetricQueryAction } from '@/app/actions/sabbi-models.actions';
import type { BiChartRunResponse, BiChartType } from '@/lib/rust-client/bi-charts';
import type { BiModelDoc } from '@/lib/rust-client/bi-models';
import type { BoardCard, BoardDoc, BoardRls } from '@/lib/sabbi/boards.server';

import { ResultChart, type ResultChartType } from '../../_components/result-chart';

const SERVER_TYPE: Record<string, BiChartType> = {
  table: 'table', kpi: 'table', bar: 'bar', stacked: 'bar', line: 'line', area: 'line', pie: 'pie', donut: 'pie',
};
const CHART_OPTS: ResultChartType[] = ['bar', 'stacked', 'line', 'area', 'pie', 'donut', 'kpi', 'table'];
const selectCls =
  'h-9 rounded-[var(--st-radius-sm)] border border-[var(--st-border)] bg-[var(--st-surface)] px-2 text-sm text-[var(--st-text)]';

interface CrossFilter {
  column: string;
  value: string;
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function BoardCardView({
  card,
  model,
  crossFilters,
  onPick,
  editMode,
  onRemove,
}: {
  card: BoardCard;
  model?: BiModelDoc;
  crossFilters: CrossFilter[];
  onPick: (column: string, value: string) => void;
  editMode: boolean;
  onRemove: () => void;
}) {
  const [result, setResult] = useState<BiChartRunResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const formats = useMemo(
    () => Object.fromEntries((model?.measures ?? []).map((m) => [m.key, m.format])),
    [model],
  );
  const cfKey = JSON.stringify(crossFilters);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const res = await runMetricQueryAction({
          modelId: card.modelId,
          measures: card.measures,
          dimensions: card.dimensions,
          segments: card.segments,
          filters: crossFilters.map((f) => ({ column: f.column, op: 'eq', value: f.value })),
          chartType: SERVER_TYPE[card.chartType] ?? 'bar',
          limit: 100,
        });
        if (!cancelled) setResult(res);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Query failed');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.modelId, card.chartType, JSON.stringify(card.measures), JSON.stringify(card.dimensions), JSON.stringify(card.segments), cfKey]);

  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-2">
        <CardTitle className="truncate text-sm">{card.title}</CardTitle>
        {editMode && (
          <Button variant="ghost" size="icon" aria-label="Remove card" onClick={onRemove}>
            <Trash2 size={14} aria-hidden="true" />
          </Button>
        )}
      </CardHeader>
      <CardBody>
        {error ? (
          <p className="text-sm text-[var(--st-danger)]">{error}</p>
        ) : result ? (
          <ResultChart
            result={result}
            type={card.chartType as ResultChartType}
            formats={formats}
            height={260}
            onPick={editMode ? undefined : onPick}
          />
        ) : (
          <div className="flex h-40 items-center justify-center text-sm text-[var(--st-text-secondary)]">Loading…</div>
        )}
      </CardBody>
    </Card>
  );
}

export function BoardView({ board, models }: { board: BoardDoc; models: BiModelDoc[] }) {
  const [cards, setCards] = useState<BoardCard[]>(board.cards ?? []);
  const [crossFilters, setCrossFilters] = useState<CrossFilter[]>([]);
  const [editMode, setEditMode] = useState((board.cards ?? []).length === 0);
  const [saving, startSave] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const modelById = useMemo(() => new Map(models.map((m) => [m._id, m])), [models]);

  // Add-card dialog state.
  const [open, setOpen] = useState(false);
  const [dModel, setDModel] = useState(models[0]?._id ?? '');
  const [dTitle, setDTitle] = useState('');
  const [dMeasures, setDMeasures] = useState<string[]>([]);
  const [dDims, setDDims] = useState<string[]>([]);
  const [dType, setDType] = useState<ResultChartType>('bar');
  const [dW, setDW] = useState(6);
  const dModelDoc = modelById.get(dModel);

  // Share / RLS state.
  const [shareOpen, setShareOpen] = useState(false);
  const [isPublic, setIsPublic] = useState(!!board.isPublic);
  const [shareToken, setShareToken] = useState(board.shareToken ?? '');
  const [rls, setRls] = useState<BoardRls[]>(board.rls ?? []);
  const [sharing, startShare] = useTransition();

  function saveShare() {
    startShare(async () => {
      const res = await shareBoardAction(board._id, isPublic, rls.filter((f) => f.column.trim()));
      setShareToken(res.shareToken ?? '');
    });
  }
  const publicUrl =
    shareToken && typeof window !== 'undefined'
      ? `${window.location.origin}/embed/sabbi/board/${shareToken}`
      : '';

  function addCard() {
    const card: BoardCard = {
      id: randomId(),
      title: dTitle.trim() || dModelDoc?.name || 'Card',
      modelId: dModel,
      measures: dMeasures,
      dimensions: dDims,
      segments: [],
      chartType: dType,
      w: dW,
    };
    setCards((c) => [...c, card]);
    setOpen(false);
    setDTitle('');
    setDMeasures([]);
    setDDims([]);
  }

  function pick(column: string, value: string) {
    setCrossFilters((cf) =>
      cf.some((f) => f.column === column && f.value === value) ? cf : [...cf, { column, value }],
    );
  }

  function save() {
    startSave(async () => {
      await updateBoardAction(board._id, { cards });
      setSavedAt(new Date().toLocaleTimeString());
      setEditMode(false);
    });
  }

  function toggle(list: string[], set: (v: string[]) => void, key: string) {
    set(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
  }

  return (
    <div className="20ui flex flex-col gap-[var(--st-space-5)] p-[var(--st-space-5)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabBI · Board</PageEyebrow>
          <PageTitle>{board.name}</PageTitle>
          {board.description && <PageDescription>{board.description}</PageDescription>}
        </PageHeaderHeading>
        <PageActions>
          {savedAt && <span className="text-xs text-[var(--st-text-secondary)]">Saved {savedAt}</span>}
          {isPublic && <Badge tone="success">Public</Badge>}
          <Button variant="ghost" onClick={() => setShareOpen(true)}>
            <Share2 size={16} aria-hidden="true" /> Share
          </Button>
          <Button variant="ghost" onClick={() => setEditMode((e) => !e)}>
            <Pencil size={16} aria-hidden="true" /> {editMode ? 'Done' : 'Edit'}
          </Button>
          {editMode && (
            <>
              <Button variant="ghost" onClick={() => setOpen(true)} disabled={models.length === 0}>
                <Plus size={16} aria-hidden="true" /> Add card
              </Button>
              <Button onClick={save} disabled={saving}>
                <Save size={16} aria-hidden="true" /> {saving ? 'Saving…' : 'Save'}
              </Button>
            </>
          )}
        </PageActions>
      </PageHeader>

      {/* Cross-filter bar */}
      {crossFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <FilterIcon size={14} aria-hidden="true" className="text-[var(--st-text-secondary)]" />
          {crossFilters.map((f, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCrossFilters((cf) => cf.filter((_, j) => j !== i))}
              className="cursor-pointer"
            >
              <Badge tone="accent">
                {f.column} = {f.value}
                <X size={11} aria-hidden="true" />
              </Badge>
            </button>
          ))}
          <Button variant="ghost" size="sm" onClick={() => setCrossFilters([])}>
            Clear
          </Button>
        </div>
      )}

      {cards.length === 0 ? (
        <EmptyState
          icon={Plus}
          tone="info"
          title="Empty board"
          description={models.length === 0 ? 'Connect a model first, then add cards.' : 'Add a card to start building this dashboard.'}
        />
      ) : (
        <div className="grid grid-cols-1 gap-[var(--st-space-4)] md:grid-cols-12">
          {cards.map((card) => {
            const span = Math.max(1, Math.min(card.w ?? 6, 12));
            return (
              <div key={card.id} style={{ gridColumn: `span ${span} / span ${span}` }}>
                <BoardCardView
                  card={card}
                  model={modelById.get(card.modelId)}
                  crossFilters={crossFilters}
                  onPick={pick}
                  editMode={editMode}
                  onRemove={() => setCards((c) => c.filter((x) => x.id !== card.id))}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Add-card dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add card</DialogTitle>
            <DialogDescription>Pick a model, measures, and dimensions for this card.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>Model</Label>
              <select className={selectCls} value={dModel} onChange={(e) => { setDModel(e.target.value); setDMeasures([]); setDDims([]); }}>
                {models.map((m) => (
                  <option key={m._id} value={m._id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="card-title">Title</Label>
              <Input id="card-title" value={dTitle} onChange={(e) => setDTitle(e.target.value)} placeholder={dModelDoc?.name} />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-[var(--st-text-secondary)]">Measures</p>
              <div className="flex flex-wrap gap-1.5">
                {(dModelDoc?.measures ?? []).map((m) => (
                  <button key={m.key} type="button" onClick={() => toggle(dMeasures, setDMeasures, m.key)} className="cursor-pointer">
                    <Badge tone={dMeasures.includes(m.key) ? 'success' : 'neutral'}>{m.label}</Badge>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-[var(--st-text-secondary)]">Group by</p>
              <div className="flex flex-wrap gap-1.5">
                {(dModelDoc?.dimensions ?? []).map((d) => (
                  <button key={d.key} type="button" onClick={() => toggle(dDims, setDDims, d.key)} className="cursor-pointer">
                    <Badge tone={dDims.includes(d.key) ? 'info' : 'neutral'}>{d.label}</Badge>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <div className="grid flex-1 gap-1.5">
                <Label>Chart</Label>
                <select className={selectCls} value={dType} onChange={(e) => setDType(e.target.value as ResultChartType)}>
                  {CHART_OPTS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="grid w-24 gap-1.5">
                <Label>Width</Label>
                <select className={selectCls} value={dW} onChange={(e) => setDW(Number(e.target.value))}>
                  <option value={4}>1/3</option>
                  <option value={6}>1/2</option>
                  <option value={8}>2/3</option>
                  <option value={12}>Full</option>
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={addCard} disabled={!dModel || dMeasures.length === 0}>Add card</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share board</DialogTitle>
            <DialogDescription>
              Publish a read-only public link. Row-level-security filters are forced
              on every card so viewers only see the slice you allow.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <label className="flex items-center gap-2 text-sm text-[var(--st-text)]">
              <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
              Public link enabled
            </label>
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-[var(--st-text-secondary)]">Row-level security</p>
                <Button variant="ghost" size="sm" onClick={() => setRls((r) => [...r, { column: '', op: 'eq', value: '' }])}>
                  <Plus size={14} aria-hidden="true" /> Add
                </Button>
              </div>
              {rls.map((f, i) => (
                <div key={i} className="mt-1 flex items-center gap-1.5">
                  <Input
                    value={f.column}
                    placeholder="column"
                    onChange={(e) => setRls((a) => a.map((x, j) => (j === i ? { ...x, column: e.target.value } : x)))}
                    className="font-mono text-xs"
                  />
                  <select
                    className={selectCls}
                    value={f.op}
                    onChange={(e) => setRls((a) => a.map((x, j) => (j === i ? { ...x, op: e.target.value } : x)))}
                  >
                    {['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'contains'].map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                  <Input
                    value={String(f.value ?? '')}
                    placeholder="value"
                    onChange={(e) => setRls((a) => a.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                  />
                  <Button variant="ghost" size="icon" aria-label="Remove" onClick={() => setRls((a) => a.filter((_, j) => j !== i))}>
                    <Trash2 size={14} aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>
            {publicUrl && (
              <div className="flex items-center gap-1.5">
                <Input readOnly value={publicUrl} className="font-mono text-xs" />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Copy link"
                  onClick={() => navigator.clipboard?.writeText(publicUrl)}
                >
                  <Copy size={14} aria-hidden="true" />
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShareOpen(false)}>Close</Button>
            <Button onClick={saveShare} disabled={sharing}>{sharing ? 'Saving…' : 'Save share'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
