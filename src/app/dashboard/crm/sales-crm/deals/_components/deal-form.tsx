'use client';

import { Button, Card, Input, Label, Textarea, useZoruToast } from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect,
  useState } from 'react';
import { useRouter,
  useSearchParams } from 'next/navigation';

/**
 * <DealForm> — shared by Create + Edit flows for the canonical Deals module.
 *
 * Renders the four sections from §1D.3 (Overview, Money, Products[],
 * Profile/Notes) plus tags. Preserves every FormData key consumed by
 * `createCrmDeal` (name, stage, value, currency, accountId, contactId,
 * closeDate, probability, leadSource, priority, lossReason, nextStep,
 * campaign, pipelineId, description, fromKind, fromId, tagIds, labels).
 * Auto-saves a draft to localStorage on /new every 30s while dirty.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { EntityMultiFormField } from '@/components/crm/entity-multi-form-field';
import { EntityPicker } from '@/components/crm/entity-picker';
import { DirtyFormPrompt } from '@/components/crm/dirty-form-prompt';
import { createCrmDeal } from '@/app/actions/crm-deals.actions';
import type { CrmDeal } from '@/lib/definitions';
import type { WithId } from 'mongodb';

import { DealProductsEditor, type ProductRow } from './deal-products-editor';
import { DealCompetitorsEditor } from './deal-competitors-editor';
import { useDealDraft } from './use-deal-draft';

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
  /** Current session user id — used to scope the auto-save draft key. */
  currentUserId?: string | null;
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

export function DealForm({ initial, redirectTo, currentUserId }: DealFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useZoruToast();
  const editing = Boolean(initial?._id);
  const formRef = React.useRef<HTMLFormElement>(null);

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

  // Tags — entity-multi-pick
  const [tagIds, setTagIds] = useState<string[]>(() => {
    const labelIds = (initial as unknown as { tagIds?: string[] } | null)?.tagIds;
    return Array.isArray(labelIds) ? labelIds : [];
  });

  // Dirty tracking — pretty rough but sufficient for the beforeunload guard.
  const [dirty, setDirty] = useState(false);
  const markDirty = React.useCallback(() => setDirty(true), []);

  // Auto-save draft (only on /new — `editing` short-circuits this).
  const snapshotExtras = React.useCallback(
    () => ({ competitors, products, partyKind, accountId, contactId, tagIds }),
    [competitors, products, partyKind, accountId, contactId, tagIds],
  );
  const applyExtras = React.useCallback(
    (v: { competitors?: string[]; products?: ProductRow[]; partyKind?: 'client' | 'lead'; accountId?: string | null; contactId?: string | null; tagIds?: string[] }) => {
      if (v.products) setProducts(v.products);
      if (v.competitors) setCompetitors(v.competitors);
      if (v.partyKind) setPartyKind(v.partyKind);
      if (v.accountId !== undefined) setAccountId(v.accountId);
      if (v.contactId !== undefined) setContactId(v.contactId);
      if (v.tagIds) setTagIds(v.tagIds);
      setDirty(true);
    },
    [],
  );
  const {
    draftAvailable,
    draftDismissed,
    restore: restoreDraft,
    discard: discardDraft,
    clearOnSave: clearDraftOnSave,
  } = useDealDraft({
    enabled: !editing,
    dirty,
    currentUserId: currentUserId ?? null,
    formRef,
    snapshotExtras,
    applyExtras,
  });

  /* Effects */
  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      setDirty(false);
      // Clear the auto-saved draft now that the server accepted the save.
      clearDraftOnSave();
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
      ref={formRef}
      action={formAction}
      onChange={markDirty}
      className="flex w-full flex-col gap-6"
    >
      <DirtyFormPrompt dirty={dirty} />

      {/* Restore-draft banner (only on /new, only if a draft exists) */}
      {!editing && draftAvailable && !draftDismissed ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-zoru-line/40 bg-zoru-ink/10 px-3 py-2 text-[12.5px] text-zoru-ink dark:text-zoru-ink-muted">
          <span>You have an unsaved draft from a previous session.</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" type="button" onClick={restoreDraft}>
              Restore draft
            </Button>
            <Button size="sm" variant="ghost" type="button" onClick={discardDraft}>
              Discard
            </Button>
          </div>
        </div>
      ) : null}

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
      <Card className="space-y-4 p-6">
        <div>
          <h2 className="text-[15px] font-semibold text-zoru-ink">Overview</h2>
          <p className="text-[12.5px] text-zoru-ink-muted">
            Identify the opportunity, owner, and pipeline.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2 space-y-1.5">
            <Label htmlFor="name">
              Title <span className="text-zoru-danger-ink">*</span>
            </Label>
            <Input
              id="name"
              name="name"
              required
              defaultValue={initial?.name ?? prefillTitle}
              placeholder="e.g. Acme Corp — Enterprise Plan"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ownerId">
              Owner <span className="text-zoru-danger-ink">*</span>
            </Label>
            <EntityFormField
              entity="user"
              name="ownerId"
              initialId={initial?.ownerId ? String(initial.ownerId) : null}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pipelineId">
              Pipeline <span className="text-zoru-danger-ink">*</span>
            </Label>
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
            <Label htmlFor="stage">
              Stage <span className="text-zoru-danger-ink">*</span>
            </Label>
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
            <Label>
              Counter-party type <span className="text-zoru-danger-ink">*</span>
            </Label>
            <EnumFormField
              enumName="partyKind"
              name="partyKindPicker"
              initialId={partyKind}
              allowInlineCreate={false}
              onChange={(next) => {
                if (next === 'client' || next === 'lead') {
                  setPartyKind(next as PartyKind);
                  markDirty();
                }
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label>
              {partyKind === 'client' ? 'Client' : 'Lead / contact'}
            </Label>
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
      </Card>

      {/* ─── Section 2: Money ─────────────────────────────────────────── */}
      <Card className="space-y-4 p-6">
        <div>
          <h2 className="text-[15px] font-semibold text-zoru-ink">Money</h2>
          <p className="text-[12.5px] text-zoru-ink-muted">
            Deal value, currency, win probability, and expected close.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="value">
              Amount <span className="text-zoru-danger-ink">*</span>
            </Label>
            <Input
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
            <Label htmlFor="currency">Currency</Label>
            <EntityFormField
              entity="currency"
              name="currency"
              initialId={initial?.currency ?? 'INR'}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="probability">Probability (%)</Label>
            <Input
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
            <Label htmlFor="closeDate">Expected close date</Label>
            <Input
              id="closeDate"
              name="closeDate"
              type="date"
              defaultValue={asDateInput(initial?.closeDate)}
            />
          </div>
        </div>
      </Card>

      {/* ─── Section 3: Products ──────────────────────────────────────── */}
      <Card className="space-y-4 p-6">
        <DealProductsEditor
          products={products}
          onAdd={addProduct}
          onRemove={removeProduct}
          onPatch={patchProduct}
        />
      </Card>

      {/* ─── Section 4: Competitors ───────────────────────────────────── */}
      <Card className="space-y-4 p-6">
        <DealCompetitorsEditor
          competitors={competitors}
          onAdd={(name) => {
            setCompetitors((arr) => (arr.includes(name) ? arr : [...arr, name]));
            markDirty();
          }}
          onRemove={removeCompetitor}
        />
      </Card>

      {/* ─── Section 5: Profile (source/priority/tags) + Notes ────────── */}
      <Card className="space-y-4 p-6">
        <div>
          <h2 className="text-[15px] font-semibold text-zoru-ink">Profile & notes</h2>
          <p className="text-[12.5px] text-zoru-ink-muted">
            Lead source, priority, next step, and free-text notes.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="leadSource">Lead source</Label>
            <EntityFormField
              entity="leadSource"
              name="leadSource"
              initialId={initial?.leadSource ?? prefillSource ?? null}
              placeholder="Select source"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Priority</Label>
            <EnumFormField
              enumName="ticketPriority"
              name="priority"
              initialId={initial?.priority ?? null}
              placeholder="Select priority"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nextStep">Next step</Label>
            <Input
              id="nextStep"
              name="nextStep"
              defaultValue={initial?.nextStep ?? ''}
              placeholder="e.g. Schedule demo call"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="campaign">Campaign</Label>
            <Input
              id="campaign"
              name="campaign"
              defaultValue={initial?.campaign ?? ''}
              placeholder="Campaign reference"
            />
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <Label htmlFor="lossReason">Loss reason</Label>
            <Input
              id="lossReason"
              name="lossReason"
              defaultValue={initial?.lossReason ?? ''}
              placeholder="Only relevant if status = lost"
            />
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <Label htmlFor="description">Notes</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={initial?.description ?? ''}
              rows={4}
              placeholder="Internal notes about this opportunity"
            />
          </div>

          {/* Tags — multi-pick */}
          <div className="md:col-span-2 space-y-1.5">
            <Label>Tags</Label>
            <EntityMultiFormField
              entity="tag"
              name="tagIds"
              initialIds={tagIds}
              dualWriteName="labels"
              allowCreate
              inlineCreate
            />
          </div>
        </div>
      </Card>

      {/* Inline error (action returns { error }) */}
      {state?.error ? (
        <p role="alert" className="text-sm text-zoru-danger-ink">
          {state.error}
        </p>
      ) : null}

      {/* Sticky action bar */}
      <div className="sticky bottom-0 z-10 border-t border-zoru-line bg-zoru-bg py-3">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push(redirectTo ?? '/dashboard/crm/sales-crm/deals')}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="outline"
            onClick={setMode('saveNew')}
            name="_action"
            value="save_new"
          >
            Save &amp; new
          </Button>
          {editing ? (
            <Button
              type="submit"
              variant="outline"
              onClick={setMode('convert')}
              name="_action"
              value="save_convert"
            >
              Save &amp; convert to quotation
            </Button>
          ) : null}
          <Button type="submit" onClick={setMode('save')}>
            {editing ? 'Save changes' : 'Create deal'}
          </Button>
        </div>
      </div>
    </form>
  );
}

export default DealForm;
