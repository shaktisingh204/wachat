'use client';

/**
 * SabCRM Supply — BOM form drawer (rollout WI-10).
 *
 * BOMs are document-shaped but PARTY-LESS, and the doc-surface DocForm
 * always renders + requires a party (the kit shipped no `hideParty`
 * flag — only `hideDueDate` / `hideLines` / `hidePaymentTerms`). Rather
 * than abuse the party slot, BOMs get a dedicated 20ui Drawer form that
 * still mirrors the kit's drawer chrome (header / scroll body / footer)
 * and embeds the shared {@link BomComponentsEditor}.
 *
 * KIT GAP NOTE: a `hideParty` (or the spec's `show:{party:false}`) flag
 * on DocFormConfig would let BOM/production-orders reuse DocForm
 * directly; until then these two entities use a local drawer.
 */

import * as React from 'react';
import { X } from 'lucide-react';

import {
  Alert,
  Button,
  DatePicker,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  Field,
  Input,
  Textarea,
} from '@/components/sabcrm/20ui';

import { EntityPicker } from '@/app/sabcrm/finance/_components/doc-surface';
import {
  searchSabcrmSupplyItemOptions,
  suggestNextSupplyNumber,
} from '@/app/actions/sabcrm-supply-docs.actions';
import type { CrmBomDoc } from '@/lib/rust-client/sabcrm-supply';
import type {
  SabcrmBomFullInput,
} from '@/app/actions/sabcrm-supply-bom.actions.types';

import {
  BomComponentsEditor,
  blankBomComponent,
  type BomComponentDraft,
} from './bom-components-editor';

/* ─── Form state ───────────────────────────────────────────────── */

export interface BomFormState {
  bomNo: string;
  finishedGoodId: string | null;
  finishedGoodLabel: string | null;
  finishedGoodName: string;
  outputQty: string;
  unit: string;
  effectiveDate: string;
  version: string;
  labourCost: string;
  overheadCost: string;
  notes: string;
  components: BomComponentDraft[];
}

function emptyBomState(): BomFormState {
  return {
    bomNo: '',
    finishedGoodId: null,
    finishedGoodLabel: null,
    finishedGoodName: '',
    outputQty: '1',
    unit: 'unit',
    effectiveDate: '',
    version: '1',
    labourCost: '',
    overheadCost: '',
    notes: '',
    components: [blankBomComponent()],
  };
}

/** BOM doc → edit-form state. */
export function bomToFormState(doc: CrmBomDoc): BomFormState {
  return {
    bomNo: doc.bomNo,
    finishedGoodId: doc.finishedGoodId ?? null,
    finishedGoodLabel: doc.finishedGoodId ? doc.finishedGoodName : null,
    finishedGoodName: doc.finishedGoodName ?? '',
    outputQty: String(doc.outputQty ?? 1),
    unit: doc.unit ?? 'unit',
    effectiveDate: (doc.effectiveDate ?? '').slice(0, 10),
    version: doc.version ?? '1',
    labourCost: doc.labourCost === undefined ? '' : String(doc.labourCost),
    overheadCost:
      doc.overheadCost === undefined ? '' : String(doc.overheadCost),
    notes: doc.notes ?? '',
    components:
      (doc.components ?? []).length > 0
        ? doc.components.map((c, i) => ({
            rowId: `seed-${i}`,
            itemId: c.itemId,
            itemName: c.itemName,
            qty: c.qty,
            unit: c.unit,
            scrapPct: c.scrapPct,
            optional: c.optional,
            costPerUnit: c.costPerUnit,
          }))
        : [blankBomComponent()],
  };
}

function keyToDate(key: string): Date | undefined {
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}
function dateToKey(d: Date | undefined): string {
  if (!d) return '';
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function numOrUndef(v: string): number | undefined {
  if (v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Form state → action input. */
export function bomStateToInput(s: BomFormState): SabcrmBomFullInput {
  return {
    bomNo: s.bomNo.trim(),
    finishedGoodName: s.finishedGoodName.trim(),
    finishedGoodId: s.finishedGoodId || undefined,
    outputQty: Number(s.outputQty) || 0,
    unit: s.unit.trim(),
    effectiveDate: s.effectiveDate || undefined,
    version: s.version.trim() || '1',
    notes: s.notes.trim() || undefined,
    labourCost: numOrUndef(s.labourCost),
    overheadCost: numOrUndef(s.overheadCost),
    components: s.components
      .filter((c) => c.itemName.trim())
      .map((c) => ({
        itemId: c.itemId,
        itemName: c.itemName.trim(),
        qty: c.qty,
        unit: c.unit,
        scrapPct: c.scrapPct,
        optional: c.optional,
        costPerUnit: c.costPerUnit,
      })),
  };
}

/* ─── Drawer ───────────────────────────────────────────────────── */

export interface BomFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  initialState?: BomFormState;
  onSubmit: (
    input: SabcrmBomFullInput,
  ) => Promise<{ ok: boolean; error?: string }>;
}

export function BomForm({
  open,
  onOpenChange,
  mode,
  initialState,
  onSubmit,
}: BomFormProps): React.JSX.Element {
  const [state, setState] = React.useState<BomFormState>(
    () => initialState ?? emptyBomState(),
  );
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const seeded = React.useRef(false);

  React.useEffect(() => {
    if (!open) return;
    setState(initialState ?? emptyBomState());
    setError(null);
    seeded.current = false;
  }, [open, initialState]);

  // Auto-number once per open (create mode, empty number).
  React.useEffect(() => {
    if (!open || mode !== 'create' || seeded.current) return;
    if ((initialState?.bomNo ?? '').trim()) return;
    seeded.current = true;
    let cancelled = false;
    void suggestNextSupplyNumber('bom').then((res) => {
      if (cancelled || !res.ok || !res.data) return;
      setState((s) => (s.bomNo.trim() ? s : { ...s, bomNo: res.data }));
    });
    return () => {
      cancelled = true;
    };
  }, [open, mode, initialState]);

  const patch = (p: Partial<BomFormState>): void =>
    setState((s) => ({ ...s, ...p }));

  const validate = (): string | null => {
    if (!state.bomNo.trim()) return 'A BOM number is required.';
    if (!state.finishedGoodName.trim()) {
      return 'A finished-good name is required.';
    }
    if (!(Number(state.outputQty) > 0)) {
      return 'The output quantity must be greater than zero.';
    }
    if (!state.unit.trim()) return 'A unit is required.';
    if (state.components.every((c) => !c.itemName.trim())) {
      return 'Add at least one component.';
    }
    return null;
  };

  const submit = async (): Promise<void> => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setPending(true);
    try {
      const res = await onSubmit(bomStateToInput(state));
      if (!res.ok) {
        setError(res.error ?? 'Something went wrong.');
        return;
      }
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={(n) => !pending && onOpenChange(n)} side="right">
      <DrawerContent aria-describedby="bom-form-desc" className="fdoc-form-drawer">
        <DrawerHeader>
          <DrawerTitle>
            {mode === 'create' ? 'New bill of materials' : 'Edit bill of materials'}
          </DrawerTitle>
          <DrawerDescription id="bom-form-desc">
            Define the finished good, its output quantity and the components
            consumed to build it.
          </DrawerDescription>
        </DrawerHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="flex-1 overflow-y-auto px-5 pb-4">
            <div className="fdoc-form-grid">
              <Field label="BOM number" required>
                <Input
                  value={state.bomNo}
                  onChange={(e) => patch({ bomNo: e.target.value })}
                  placeholder="BOM-001"
                  disabled={pending}
                />
              </Field>
              <Field label="Version" required>
                <Input
                  value={state.version}
                  onChange={(e) => patch({ version: e.target.value })}
                  placeholder="1"
                  disabled={pending}
                />
              </Field>

              <Field label="Finished good (catalog)" help="Picking fills the name.">
                <EntityPicker
                  value={state.finishedGoodId}
                  valueLabel={state.finishedGoodLabel}
                  search={async (q) => {
                    const res = await searchSabcrmSupplyItemOptions(q);
                    return res.ok ? res.data : [];
                  }}
                  placeholder="Search items…"
                  disabled={pending}
                  onChange={(opt) =>
                    patch({
                      finishedGoodId: opt?.id ?? null,
                      finishedGoodLabel: opt?.label ?? null,
                      finishedGoodName: opt?.label ?? state.finishedGoodName,
                    })
                  }
                />
              </Field>
              <Field label="Finished good name" required>
                <Input
                  value={state.finishedGoodName}
                  onChange={(e) => patch({ finishedGoodName: e.target.value })}
                  placeholder="Assembled widget"
                  disabled={pending}
                />
              </Field>

              <Field label="Output quantity" required>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={state.outputQty}
                  onChange={(e) => patch({ outputQty: e.target.value })}
                  disabled={pending}
                />
              </Field>
              <Field label="Output unit" required>
                <Input
                  value={state.unit}
                  onChange={(e) => patch({ unit: e.target.value })}
                  placeholder="unit"
                  disabled={pending}
                />
              </Field>

              <Field label="Effective date">
                <DatePicker
                  value={keyToDate(state.effectiveDate)}
                  onChange={(d) => patch({ effectiveDate: dateToKey(d) })}
                  placeholder="Pick a date"
                  disabled={pending}
                  aria-label="Effective date"
                />
              </Field>
              <Field label="Labour cost">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={state.labourCost}
                  onChange={(e) => patch({ labourCost: e.target.value })}
                  placeholder="0.00"
                  disabled={pending}
                />
              </Field>
              <Field label="Overhead cost">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={state.overheadCost}
                  onChange={(e) => patch({ overheadCost: e.target.value })}
                  placeholder="0.00"
                  disabled={pending}
                />
              </Field>

              <div className="fdoc-form-grid__full">
                <Field label="Components" required>
                  <BomComponentsEditor
                    components={state.components}
                    onChange={(components) => patch({ components })}
                    disabled={pending}
                    showOptional
                  />
                </Field>
              </div>

              <div className="fdoc-form-grid__full">
                <Field label="Notes">
                  <Textarea
                    value={state.notes}
                    onChange={(e) => patch({ notes: e.target.value })}
                    rows={3}
                    placeholder="Routing notes, revision history…"
                    disabled={pending}
                  />
                </Field>
              </div>
            </div>

            {error ? (
              <div className="mt-3">
                <Alert tone="danger" role="alert">
                  {error}
                </Alert>
              </div>
            ) : null}
          </div>

          <DrawerFooter>
            <Button
              type="button"
              variant="ghost"
              iconLeft={X}
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={pending}>
              {mode === 'create' ? 'Create BOM' : 'Save changes'}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
