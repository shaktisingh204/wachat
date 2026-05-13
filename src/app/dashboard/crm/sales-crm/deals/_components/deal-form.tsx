'use client';

/**
 * <DealForm> — shared by Create + Edit flows for the canonical Deals module.
 *
 * Wraps {@link EntityFormShell} and feeds it the four sections from §1D.3
 * (Overview, Money, Products[], Profile/Notes). Preserves every FormData
 * key consumed by `createCrmDeal` in `@/app/actions/crm-deals.actions`:
 *
 *   - `name`              (string, required)
 *   - `stage`             (string, required)
 *   - `value`             (number, required)
 *   - `currency`          (string)
 *   - `accountId`         (ObjectId string — when partyKind=client)
 *   - `contactId`         (ObjectId string — when partyKind=lead/contact)
 *   - `closeDate`         (yyyy-mm-dd)
 *   - `probability`       (0–100)
 *   - `leadSource`        (string)
 *   - `priority`          (low/medium/high/critical)
 *   - `lossReason`        (string)
 *   - `nextStep`          (string)
 *   - `campaign`          (string)
 *   - `pipelineId`        (string)
 *   - `description`       (string)
 *   - `fromKind` / `fromId` (optional lineage seed)
 *
 * Adds two non-persisted fields whose JSON is interpreted client-side
 * (`products`, `competitors`) — they're surfaced through hidden inputs so
 * the legacy action keeps working. The action ignores them today but the
 * Rust path will pick them up.
 */

import * as React from 'react';
import { useActionState, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import {
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { EntityPicker } from '@/components/crm/entity-picker';
import { DirtyFormPrompt } from '@/components/crm/dirty-form-prompt';
import { createCrmDeal } from '@/app/actions/crm-deals.actions';
import type { CrmDeal } from '@/lib/definitions';
import type { WithId } from 'mongodb';

import { DealProductsEditor, type ProductRow } from './deal-products-editor';

type PartyKind = 'client' | 'lead';

const emptyProduct = (): ProductRow => ({
  itemId: null,
  name: '',
  quantity: 1,
  rate: 0,
  discount: 0,
});

const INITIAL_ACTION_STATE: { message?: string; error?: string } = {};

interface DealFormProps {
  /** Existing deal for /[id]/edit. Absent for /new. */
  initial?: WithId<CrmDeal> | null;
  /** Successful redirect; defaults to canonical list. */
  redirectTo?: string;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function asDateInput(value: unknown): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function safeNumber(n: unknown, fallback = 0): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function DealForm({ initial, redirectTo }: DealFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useZoruToast();
  const editing = Boolean(initial?._id);

  // Smart defaults from ?fromKind=lead&fromId=...
  const fromKind = (searchParams?.get('fromKind') ?? '') as '' | 'lead';
  const fromId = searchParams?.get('fromId') ?? '';
  const prefillTitle = searchParams?.get('title') ?? '';
  const prefillAmount = searchParams?.get('amount') ?? '';
  const prefillSource = searchParams?.get('leadSource') ?? '';

  /* Action state */
  const [state, formAction] = useActionState(createCrmDeal, INITIAL_ACTION_STATE);
  const [submitMode, setSubmitMode] = useState<'save' | 'saveNew' | 'convert'>('save');

  /* Local state */
  const [partyKind, setPartyKind] = useState<PartyKind>(
    initial?.accountId ? 'client' : fromKind === 'lead' ? 'lead' : 'client',
  );
  const [accountId, setAccountId] = useState<string | null>(
    initial?.accountId ? String(initial.accountId) : null,
  );
  const [contactId, setContactId] = useState<string | null>(
    initial?.contactIds?.[0] ? String(initial.contactIds[0]) : null,
  );
  const [pipelineId, setPipelineId] = useState<string | null>(initial?.pipelineId ?? null);

  // Products[] — line-items rich editor.
  const [products, setProducts] = useState<ProductRow[]>(() => {
    if (!initial?.products?.length) return [];
    return initial.products.map((p) => ({
      itemId: null,
      name: p.name ?? '',
      quantity: safeNumber(p.quantity, 1),
      rate: safeNumber(p.price, 0),
      discount: 0,
    }));
  });

  // Competitors[] — free-text chips for now.
  const [competitors, setCompetitors] = useState<string[]>(() => {
    const tagged = (initial as unknown as { competitors?: string[] } | null)?.competitors;
    return Array.isArray(tagged) ? tagged : [];
  });
  const [competitorDraft, setCompetitorDraft] = useState('');

  // Dirty tracking — pretty rough but sufficient for the beforeunload guard.
  const [dirty, setDirty] = useState(false);
  const markDirty = React.useCallback(() => setDirty(true), []);

  /* Effects */
  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      setDirty(false);
      if (submitMode === 'saveNew') {
        // Reset form (router push to /new clears state).
        router.push('/dashboard/crm/sales-crm/deals/new');
      } else if (submitMode === 'convert' && initial?._id) {
        router.push(
          `/dashboard/crm/sales/quotations/new?fromKind=deal&fromId=${String(initial._id)}`,
        );
      } else {
        router.push(redirectTo ?? '/dashboard/crm/sales-crm/deals');
      }
    }
    if (state?.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
    // We deliberately key off `state` so React only fires after each action settles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  /* Handlers */
  const addProduct = () => {
    setProducts((rows) => [...rows, emptyProduct()]);
    markDirty();
  };
  const removeProduct = (idx: number) => {
    setProducts((rows) => rows.filter((_, i) => i !== idx));
    markDirty();
  };
  const patchProduct = (idx: number, patch: Partial<ProductRow>) => {
    setProducts((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
    markDirty();
  };
  const addCompetitor = () => {
    const v = competitorDraft.trim();
    if (!v) return;
    setCompetitors((arr) => (arr.includes(v) ? arr : [...arr, v]));
    setCompetitorDraft('');
    markDirty();
  };
  const removeCompetitor = (name: string) => {
    setCompetitors((arr) => arr.filter((c) => c !== name));
    markDirty();
  };

  /* Submit-mode helper — clicking a non-default submit button sets the mode
     before the form submits, so the post-action effect routes to the right
     place. */
  const setMode = (mode: typeof submitMode) => () => setSubmitMode(mode);

  /* Render */
  return (
    <form
      action={formAction}
      onChange={markDirty}
      className="flex w-full flex-col gap-6"
    >
      <DirtyFormPrompt dirty={dirty} />

      {/* Hidden inputs preserving the legacy createCrmDeal contract. */}
      {editing ? <input type="hidden" name="_id" value={String(initial!._id)} /> : null}
      {!editing && fromKind === 'lead' && fromId ? (
        <>
          <input type="hidden" name="fromKind" value="lead" />
          <input type="hidden" name="fromId" value={fromId} />
        </>
      ) : null}
      <input type="hidden" name="accountId" value={partyKind === 'client' ? accountId ?? '' : ''} />
      <input type="hidden" name="contactId" value={partyKind === 'lead' ? contactId ?? '' : ''} />
      <input
        type="hidden"
        name="products"
        value={JSON.stringify(
          products.map((p) => ({ name: p.name, quantity: p.quantity, price: p.rate })),
        )}
      />
      <input type="hidden" name="competitors" value={JSON.stringify(competitors)} />

      {/* ─── Section 1: Overview ──────────────────────────────────────── */}
      <ZoruCard className="space-y-4 p-6">
        <div>
          <h2 className="text-[15px] font-semibold text-zoru-ink">Overview</h2>
          <p className="text-[12.5px] text-zoru-ink-muted">
            Identify the opportunity, owner, and pipeline.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2 space-y-1.5">
            <ZoruLabel htmlFor="name">
              Title <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <ZoruInput
              id="name"
              name="name"
              required
              defaultValue={initial?.name ?? prefillTitle}
              placeholder="e.g. Acme Corp — Enterprise Plan"
            />
          </div>

          <div className="space-y-1.5">
            <ZoruLabel htmlFor="ownerId">
              Owner <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <EntityFormField
              entity="user"
              name="ownerId"
              initialId={initial?.ownerId ? String(initial.ownerId) : null}
              required
            />
          </div>

          <div className="space-y-1.5">
            <ZoruLabel htmlFor="pipelineId">
              Pipeline <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <EntityFormField
              entity="pipeline"
              name="pipelineId"
              initialId={initial?.pipelineId ?? null}
              onChange={(next) => {
                setPipelineId(next);
                markDirty();
              }}
              required
            />
          </div>

          <div className="space-y-1.5">
            <ZoruLabel htmlFor="stage">
              Stage <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <EntityFormField
              entity="stage"
              name="stage"
              initialId={initial?.stage ?? null}
              filter={pipelineId ? { pipelineId } : undefined}
              required
            />
          </div>

          {/* Counter-party discriminator — `client` ↔ `lead` */}
          <div className="space-y-1.5">
            <ZoruLabel>
              Counter-party type <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <ZoruSelect
              value={partyKind}
              onValueChange={(v) => {
                setPartyKind(v as PartyKind);
                markDirty();
              }}
            >
              <ZoruSelectTrigger>
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="client">Client (account)</ZoruSelectItem>
                <ZoruSelectItem value="lead">Lead / contact</ZoruSelectItem>
              </ZoruSelectContent>
            </ZoruSelect>
          </div>

          <div className="space-y-1.5">
            <ZoruLabel>
              {partyKind === 'client' ? 'Client' : 'Lead / contact'}
            </ZoruLabel>
            <EntityPicker
              entity={partyKind === 'client' ? 'client' : 'lead'}
              value={partyKind === 'client' ? accountId : contactId}
              onChange={(next) => {
                const id = typeof next === 'string' ? next : null;
                if (partyKind === 'client') setAccountId(id);
                else setContactId(id);
                markDirty();
              }}
            />
          </div>
        </div>
      </ZoruCard>

      {/* ─── Section 2: Money ─────────────────────────────────────────── */}
      <ZoruCard className="space-y-4 p-6">
        <div>
          <h2 className="text-[15px] font-semibold text-zoru-ink">Money</h2>
          <p className="text-[12.5px] text-zoru-ink-muted">
            Deal value, currency, win probability, and expected close.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <ZoruLabel htmlFor="value">
              Amount <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <ZoruInput
              id="value"
              name="value"
              type="number"
              step="0.01"
              min={0}
              required
              defaultValue={initial?.value ?? prefillAmount ?? ''}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-1.5">
            <ZoruLabel htmlFor="currency">Currency</ZoruLabel>
            <EntityFormField
              entity="currency"
              name="currency"
              initialId={initial?.currency ?? 'INR'}
            />
          </div>

          <div className="space-y-1.5">
            <ZoruLabel htmlFor="probability">Probability (%)</ZoruLabel>
            <ZoruInput
              id="probability"
              name="probability"
              type="number"
              min={0}
              max={100}
              defaultValue={initial?.probability ?? ''}
              placeholder="e.g. 60"
            />
          </div>

          <div className="space-y-1.5">
            <ZoruLabel htmlFor="closeDate">Expected close date</ZoruLabel>
            <ZoruInput
              id="closeDate"
              name="closeDate"
              type="date"
              defaultValue={asDateInput(initial?.closeDate)}
            />
          </div>
        </div>
      </ZoruCard>

      {/* ─── Section 3: Products ──────────────────────────────────────── */}
      <ZoruCard className="space-y-4 p-6">
        <DealProductsEditor
          products={products}
          onAdd={addProduct}
          onRemove={removeProduct}
          onPatch={patchProduct}
        />
      </ZoruCard>

      {/* ─── Section 4: Competitors ───────────────────────────────────── */}
      <ZoruCard className="space-y-4 p-6">
        <div>
          <h2 className="text-[15px] font-semibold text-zoru-ink">Competitors</h2>
          <p className="text-[12.5px] text-zoru-ink-muted">
            Free-text chips for now — wire to a vendor picker in a follow-up.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {competitors.map((c) => (
            <span
              key={c}
              className="inline-flex items-center gap-1 rounded-full border border-zoru-line bg-zoru-surface-2 px-2 py-0.5 text-[12px]"
            >
              {c}
              <button
                type="button"
                onClick={() => removeCompetitor(c)}
                className="text-zoru-ink-muted hover:text-zoru-ink"
                aria-label={`Remove ${c}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <ZoruInput
            placeholder="Add competitor name…"
            value={competitorDraft}
            onChange={(e) => setCompetitorDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCompetitor();
              }
            }}
            className="max-w-xs"
          />
          <ZoruButton type="button" variant="outline" size="sm" onClick={addCompetitor}>
            Add
          </ZoruButton>
        </div>
      </ZoruCard>

      {/* ─── Section 5: Profile (source/priority/tags) + Notes ────────── */}
      <ZoruCard className="space-y-4 p-6">
        <div>
          <h2 className="text-[15px] font-semibold text-zoru-ink">Profile & notes</h2>
          <p className="text-[12.5px] text-zoru-ink-muted">
            Lead source, priority, next step, and free-text notes.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <ZoruLabel htmlFor="leadSource">Lead source</ZoruLabel>
            <EntityFormField
              entity="leadSource"
              name="leadSource"
              initialId={initial?.leadSource ?? prefillSource ?? null}
              placeholder="Select source"
            />
          </div>

          <div className="space-y-1.5">
            <ZoruLabel htmlFor="priority">Priority</ZoruLabel>
            <ZoruSelect name="priority" defaultValue={initial?.priority ?? undefined}>
              <ZoruSelectTrigger id="priority">
                <ZoruSelectValue placeholder="Select priority" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="low">Low</ZoruSelectItem>
                <ZoruSelectItem value="medium">Medium</ZoruSelectItem>
                <ZoruSelectItem value="high">High</ZoruSelectItem>
                <ZoruSelectItem value="critical">Critical</ZoruSelectItem>
              </ZoruSelectContent>
            </ZoruSelect>
          </div>

          <div className="space-y-1.5">
            <ZoruLabel htmlFor="nextStep">Next step</ZoruLabel>
            <ZoruInput
              id="nextStep"
              name="nextStep"
              defaultValue={initial?.nextStep ?? ''}
              placeholder="e.g. Schedule demo call"
            />
          </div>

          <div className="space-y-1.5">
            <ZoruLabel htmlFor="campaign">Campaign</ZoruLabel>
            <ZoruInput
              id="campaign"
              name="campaign"
              defaultValue={initial?.campaign ?? ''}
              placeholder="Campaign reference"
            />
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <ZoruLabel htmlFor="lossReason">Loss reason</ZoruLabel>
            <ZoruInput
              id="lossReason"
              name="lossReason"
              defaultValue={initial?.lossReason ?? ''}
              placeholder="Only relevant if status = lost"
            />
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <ZoruLabel htmlFor="description">Notes</ZoruLabel>
            <ZoruTextarea
              id="description"
              name="description"
              defaultValue={initial?.description ?? ''}
              rows={4}
              placeholder="Internal notes about this opportunity"
            />
          </div>
        </div>
      </ZoruCard>

      {/* Inline error (action returns { error }) */}
      {state?.error ? (
        <p role="alert" className="text-sm text-zoru-danger-ink">
          {state.error}
        </p>
      ) : null}

      {/* Sticky action bar */}
      <div className="sticky bottom-0 z-10 border-t border-zoru-line bg-zoru-bg py-3">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ZoruButton
            type="button"
            variant="ghost"
            onClick={() => router.push(redirectTo ?? '/dashboard/crm/sales-crm/deals')}
          >
            Cancel
          </ZoruButton>
          <ZoruButton
            type="submit"
            variant="outline"
            onClick={setMode('saveNew')}
            name="_action"
            value="save_new"
          >
            Save &amp; new
          </ZoruButton>
          {editing ? (
            <ZoruButton
              type="submit"
              variant="outline"
              onClick={setMode('convert')}
              name="_action"
              value="save_convert"
            >
              Save &amp; convert to quotation
            </ZoruButton>
          ) : null}
          <ZoruButton type="submit" onClick={setMode('save')}>
            {editing ? 'Save changes' : 'Create deal'}
          </ZoruButton>
        </div>
      </div>
    </form>
  );
}

export default DealForm;
