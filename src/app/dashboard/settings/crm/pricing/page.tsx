'use client';

/**
 * SabCRM — CPQ pricing settings (`/dashboard/settings/crm/pricing`).
 *
 * A two-pane editor (mirrors `../scoring/page.tsx`):
 *
 *   LEFT  — the project's price books. Each row shows the name, currency,
 *           entry count and an enabled/off badge. "New" starts a draft.
 *
 *   RIGHT — the editor for the selected book: name, currency, enabled switch,
 *           the discount-approval THRESHOLD %, and an ordered list of ENTRIES
 *           (catalog item + list price + volume TIERS). Saving persists via the
 *           gated `savePriceBookTw`.
 *
 * Pure 20ui. Auth/RBAC/project are enforced by `../../layout.tsx`; every action
 * independently re-runs the full gate. Degrades to loading / empty / error and
 * never crashes when the engine is unreachable.
 */

import * as React from 'react';
import { Plus, Trash2, Tags, Save, X, Layers } from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
  IconButton,
  Card,
  Field,
  Input,
  Switch,
  Badge,
  Alert,
  EmptyState,
  Skeleton,
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
  useToast,
} from '@/components/sabcrm/20ui';
import { useProject } from '@/context/project-context';
import {
  listPriceBooksTw,
  savePriceBookTw,
  deletePriceBookTw,
} from '@/app/actions/sabcrm-pricing.actions';
import type {
  PriceBook,
  PriceBookEntry,
  PriceTier,
} from '@/lib/sabcrm/pricing';

// ---------------------------------------------------------------------------
// Local draft shapes (no server-only import)
// ---------------------------------------------------------------------------

interface DraftEntry extends PriceBookEntry {
  /** Stable client key (entries have no id of their own). */
  rowId: string;
}
interface DraftBook {
  id?: string;
  name: string;
  currency: string;
  enabled: boolean;
  thresholdPct: number;
  entries: DraftEntry[];
}

function genId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID?.() ?? `e_${Math.random().toString(36).slice(2, 12)}`;
}

function newEntry(): DraftEntry {
  return { rowId: genId(), itemId: '', itemLabel: '', listPrice: 0, tiers: [] };
}
function newTier(): PriceTier {
  return { minQty: 0, discountPct: 0 };
}
function emptyDraft(): DraftBook {
  return {
    name: 'New price book',
    currency: 'INR',
    enabled: true,
    thresholdPct: 15,
    entries: [newEntry()],
  };
}

function toDraft(b: PriceBook): DraftBook {
  return {
    id: b.id,
    name: b.name,
    currency: b.currency,
    enabled: b.enabled,
    thresholdPct: b.thresholdPct,
    entries:
      b.entries.length > 0
        ? b.entries.map((e) => ({
            rowId: genId(),
            itemId: e.itemId,
            itemLabel: e.itemLabel ?? '',
            listPrice: e.listPrice,
            tiers: (e.tiers ?? []).map((t) => ({ ...t })),
          }))
        : [newEntry()],
  };
}

/** Strip the client rowId + drop blank entries/tiers for persistence. */
function normalizeForSave(draft: DraftBook): {
  name: string;
  currency: string;
  enabled: boolean;
  thresholdPct: number;
  entries: PriceBookEntry[];
} {
  const entries: PriceBookEntry[] = draft.entries
    .filter((e) => e.itemId.trim())
    .map((e) => ({
      itemId: e.itemId.trim(),
      itemLabel: e.itemLabel?.trim() || undefined,
      listPrice: Number.isFinite(e.listPrice) ? Number(e.listPrice) : 0,
      tiers: (e.tiers ?? [])
        .filter((t) => Number.isFinite(t.minQty))
        .map((t) => ({
          minQty: Number(t.minQty),
          discountPct: Number(t.discountPct),
          label: t.label?.trim() || undefined,
        }))
        .sort((a, b) => a.minQty - b.minQty),
    }));
  return {
    name: draft.name.trim() || 'Untitled price book',
    currency: draft.currency.trim().toUpperCase() || 'INR',
    enabled: draft.enabled,
    thresholdPct: Number.isFinite(draft.thresholdPct)
      ? Math.min(100, Math.max(0, Number(draft.thresholdPct)))
      : 15,
    entries,
  };
}

export default function PricingSettingsPage(): React.ReactElement {
  const { activeProjectId, isLoadingProject } = useProject();
  const { toast } = useToast();

  const [books, setBooks] = React.useState<PriceBook[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<DraftBook | null>(null);

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  React.useEffect(() => {
    if (!activeProjectId) return;
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      const res = await listPriceBooksTw(activeProjectId);
      if (!alive) return;
      if (res.ok) setBooks(res.data);
      else setError(res.error);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [activeProjectId]);

  function selectBook(b: PriceBook): void {
    setSelectedId(b.id);
    setDraft(toDraft(b));
  }
  function startNew(): void {
    setSelectedId(null);
    setDraft(emptyDraft());
  }
  function patchDraft(patch: Partial<DraftBook>): void {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  }
  function patchEntry(idx: number, patch: Partial<DraftEntry>): void {
    setDraft((d) =>
      d
        ? {
            ...d,
            entries: d.entries.map((e, i) =>
              i === idx ? { ...e, ...patch } : e,
            ),
          }
        : d,
    );
  }
  function patchTier(
    entryIdx: number,
    tierIdx: number,
    patch: Partial<PriceTier>,
  ): void {
    setDraft((d) =>
      d
        ? {
            ...d,
            entries: d.entries.map((e, i) =>
              i === entryIdx
                ? {
                    ...e,
                    tiers: (e.tiers ?? []).map((t, j) =>
                      j === tierIdx ? { ...t, ...patch } : t,
                    ),
                  }
                : e,
            ),
          }
        : d,
    );
  }

  async function save(): Promise<void> {
    if (!draft || !activeProjectId) return;
    setSaving(true);
    const input = normalizeForSave(draft);
    const res = await savePriceBookTw({ id: draft.id, ...input }, activeProjectId);
    setSaving(false);
    if (!res.ok) {
      toast({ title: 'Could not save', description: res.error, tone: 'danger' });
      return;
    }
    toast({ title: 'Price book saved', tone: 'success' });
    const listRes = await listPriceBooksTw(activeProjectId);
    if (listRes.ok) setBooks(listRes.data);
    selectBook(res.data);
  }

  async function remove(): Promise<void> {
    if (!draft?.id || !activeProjectId) return;
    setConfirmDelete(false);
    setBusy(true);
    const res = await deletePriceBookTw(draft.id, activeProjectId);
    setBusy(false);
    if (!res.ok) {
      toast({ title: 'Could not delete', description: res.error, tone: 'danger' });
      return;
    }
    setBooks((prev) => prev.filter((b) => b.id !== draft.id));
    setDraft(null);
    setSelectedId(null);
    toast({ title: 'Price book deleted', tone: 'success' });
  }

  return (
    <>
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>CPQ pricing</PageTitle>
          <PageDescription>
            Price books with list prices and volume tiers, plus the discount
            threshold above which a quote needs approval.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus} onClick={startNew}>
            New price book
          </Button>
        </PageActions>
      </PageHeader>

      {error && (
        <Alert tone="danger" className="mb-[var(--st-space-3)]">
          {error}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-[var(--st-space-4)] lg:grid-cols-[280px_1fr]">
        {/* LEFT — list */}
        <div className="flex flex-col gap-[var(--st-space-2)]">
          {loading || isLoadingProject ? (
            <>
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </>
          ) : books.length === 0 ? (
            <EmptyState
              icon={Tags}
              title="No price books yet"
              description="Create a price book to drive CPQ pricing."
            />
          ) : (
            books.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => selectBook(b)}
                className={`flex flex-col gap-1 rounded-[var(--st-radius)] border px-[var(--st-space-3)] py-[var(--st-space-2)] text-left transition-colors ${
                  selectedId === b.id
                    ? 'border-[var(--st-accent)] bg-[var(--st-bg-secondary)]'
                    : 'border-[var(--st-border)] hover:bg-[var(--st-bg-secondary)]'
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-[var(--st-text)]">
                    {b.name}
                  </span>
                  <Badge tone={b.enabled ? 'success' : 'neutral'} kind="soft">
                    {b.enabled ? 'On' : 'Off'}
                  </Badge>
                </span>
                <span className="text-[12px] text-[var(--st-text-secondary)]">
                  {b.currency} · {b.entries.length} item
                  {b.entries.length === 1 ? '' : 's'} · approve &gt;{' '}
                  {b.thresholdPct}%
                </span>
              </button>
            ))
          )}
        </div>

        {/* RIGHT — editor */}
        <div>
          {!draft ? (
            <Card className="p-[var(--st-space-5)]">
              <EmptyState
                icon={Tags}
                title="Select or create a price book"
                description="List prices + volume tiers per item; a discount threshold that gates approvals."
              />
            </Card>
          ) : (
            <Card className="flex flex-col gap-[var(--st-space-4)] p-[var(--st-space-4)]">
              <div className="grid grid-cols-1 gap-[var(--st-space-3)] sm:grid-cols-3">
                <Field label="Name" className="sm:col-span-2">
                  <Input
                    value={draft.name}
                    onChange={(e) => patchDraft({ name: e.target.value })}
                    placeholder="e.g. FY26 standard pricing"
                  />
                </Field>
                <Field label="Currency">
                  <Input
                    value={draft.currency}
                    onChange={(e) =>
                      patchDraft({ currency: e.target.value.toUpperCase() })
                    }
                    placeholder="INR"
                    maxLength={3}
                  />
                </Field>
              </div>

              <div className="flex flex-wrap items-center gap-[var(--st-space-4)]">
                <div className="flex items-center gap-[var(--st-space-3)]">
                  <Switch
                    checked={draft.enabled}
                    aria-label="Enable price book"
                    onCheckedChange={(enabled) => patchDraft({ enabled })}
                  />
                  <span className="text-[13px] text-[var(--st-text)]">
                    Enabled — used to price quotes
                  </span>
                </div>
                <Field
                  label="Discount approval threshold %"
                  className="w-[220px]"
                >
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={100}
                    value={
                      Number.isFinite(draft.thresholdPct)
                        ? draft.thresholdPct
                        : 0
                    }
                    onChange={(e) =>
                      patchDraft({ thresholdPct: Number(e.target.value) })
                    }
                  />
                </Field>
              </div>

              {/* Entries */}
              <div className="flex flex-col gap-[var(--st-space-3)]">
                <span className="text-[13px] font-semibold text-[var(--st-text)]">
                  Items
                </span>
                {draft.entries.map((entry, i) => (
                  <div
                    key={entry.rowId}
                    className="flex flex-col gap-[var(--st-space-2)] rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-[var(--st-space-3)]"
                  >
                    <div className="flex flex-wrap items-end gap-[var(--st-space-2)]">
                      <Field
                        label="Item id"
                        className="min-w-[200px] flex-1"
                        help="Catalog item id (24-char hex)."
                      >
                        <Input
                          value={entry.itemId}
                          onChange={(e) =>
                            patchEntry(i, { itemId: e.target.value })
                          }
                          placeholder="64f0…"
                        />
                      </Field>
                      <Field label="Label" className="min-w-[140px] flex-1">
                        <Input
                          value={entry.itemLabel ?? ''}
                          onChange={(e) =>
                            patchEntry(i, { itemLabel: e.target.value })
                          }
                          placeholder="Pro plan"
                        />
                      </Field>
                      <Field label="List price" className="w-[130px]">
                        <Input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="0.01"
                          value={
                            Number.isFinite(entry.listPrice)
                              ? entry.listPrice
                              : 0
                          }
                          onChange={(e) =>
                            patchEntry(i, { listPrice: Number(e.target.value) })
                          }
                        />
                      </Field>
                      <IconButton
                        icon={Trash2}
                        label="Remove item"
                        variant="ghost"
                        onClick={() =>
                          patchDraft({
                            entries: draft.entries.filter((_, j) => j !== i),
                          })
                        }
                      />
                    </div>

                    {/* Volume tiers */}
                    <div className="flex flex-col gap-[var(--st-space-1)] pl-[var(--st-space-2)]">
                      <span className="flex items-center gap-1 text-[12px] font-medium text-[var(--st-text-secondary)]">
                        <Layers className="h-3.5 w-3.5" aria-hidden /> Volume
                        tiers
                      </span>
                      {(entry.tiers ?? []).map((tier, j) => (
                        <div
                          key={j}
                          className="flex flex-wrap items-end gap-[var(--st-space-2)]"
                        >
                          <Field label="Qty ≥" className="w-[100px]">
                            <Input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              value={
                                Number.isFinite(tier.minQty) ? tier.minQty : 0
                              }
                              onChange={(e) =>
                                patchTier(i, j, { minQty: Number(e.target.value) })
                              }
                            />
                          </Field>
                          <Field label="Discount %" className="w-[120px]">
                            <Input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={100}
                              value={
                                Number.isFinite(tier.discountPct)
                                  ? tier.discountPct
                                  : 0
                              }
                              onChange={(e) =>
                                patchTier(i, j, {
                                  discountPct: Number(e.target.value),
                                })
                              }
                            />
                          </Field>
                          <IconButton
                            icon={X}
                            label="Remove tier"
                            variant="ghost"
                            onClick={() =>
                              patchEntry(i, {
                                tiers: (entry.tiers ?? []).filter(
                                  (_, k) => k !== j,
                                ),
                              })
                            }
                          />
                        </div>
                      ))}
                      <Button
                        variant="ghost"
                        size="sm"
                        iconLeft={Plus}
                        onClick={() =>
                          patchEntry(i, {
                            tiers: [...(entry.tiers ?? []), newTier()],
                          })
                        }
                      >
                        Add tier
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  iconLeft={Plus}
                  onClick={() =>
                    patchDraft({ entries: [...draft.entries, newEntry()] })
                  }
                >
                  Add item
                </Button>
              </div>

              {/* Footer actions */}
              <div className="flex items-center justify-between gap-[var(--st-space-2)] border-t border-[var(--st-border)] pt-[var(--st-space-3)]">
                <Button
                  variant="primary"
                  iconLeft={Save}
                  onClick={save}
                  loading={saving}
                  disabled={saving}
                >
                  Save
                </Button>
                {draft.id && (
                  <Button
                    variant="ghost"
                    iconLeft={Trash2}
                    onClick={() => setConfirmDelete(true)}
                    disabled={busy}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this price book?</AlertDialogTitle>
            <AlertDialogDescription>
              Quotes already priced keep their stored totals. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
