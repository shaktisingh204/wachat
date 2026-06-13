'use client';

/**
 * SabCRM Supply — Production-order form drawer (rollout WI-11).
 *
 * Like BOMs, production orders are document-shaped but PARTY-LESS, so
 * they get a dedicated 20ui Drawer form (the kit's DocForm has no
 * `hideParty` flag). Picking a BOM prefills the finished good + unit +
 * components via a follow-up `getSabcrmSupplyProductionOrderBomPrefill`.
 * Components reuse the shared {@link BomComponentsEditor} with the
 * `optional` switch hidden (the crate component lacks that flag).
 *
 * KIT GAP NOTE: see `bom-form.tsx` — a `hideParty` flag on
 * DocFormConfig would let this entity reuse DocForm directly.
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
  toast,
} from '@/components/sabcrm/20ui';

import { EntityPicker } from '@/app/sabcrm/finance/_components/doc-surface';
import {
  searchSabcrmSupplyItemOptions,
  searchSabcrmSupplyBoms,
  suggestNextSupplyNumber,
} from '@/app/actions/sabcrm-supply-docs.actions';
import { searchSabcrmEmployees } from '@/app/actions/sabcrm-people-employees.actions';
import { getSabcrmSupplyProductionOrderBomPrefill } from '@/app/actions/sabcrm-supply-production-orders.actions';
import type { CrmProductionOrderDoc } from '@/lib/rust-client/sabcrm-supply';
import type { SabcrmProductionOrderFullInput } from '@/app/actions/sabcrm-supply-production-orders.actions.types';

import {
  BomComponentsEditor,
  blankBomComponent,
  type BomComponentDraft,
} from '../bom/bom-components-editor';

/* ─── Form state ───────────────────────────────────────────────── */

export interface ProductionOrderFormState {
  orderNo: string;
  bomId: string | null;
  bomLabel: string | null;
  bomRef: string;
  finishedGoodId: string | null;
  finishedGoodLabel: string | null;
  finishedGoodName: string;
  plannedQty: string;
  unit: string;
  plannedStart: string;
  plannedEnd: string;
  machineId: string;
  machineOperatorId: string | null;
  machineOperatorLabel: string | null;
  machineOperator: string;
  labourCost: string;
  overheadCost: string;
  notes: string;
  components: BomComponentDraft[];
}

function emptyState(): ProductionOrderFormState {
  return {
    orderNo: '',
    bomId: null,
    bomLabel: null,
    bomRef: '',
    finishedGoodId: null,
    finishedGoodLabel: null,
    finishedGoodName: '',
    plannedQty: '1',
    unit: 'unit',
    plannedStart: '',
    plannedEnd: '',
    machineId: '',
    machineOperatorId: null,
    machineOperatorLabel: null,
    machineOperator: '',
    labourCost: '',
    overheadCost: '',
    notes: '',
    components: [blankBomComponent()],
  };
}

export function productionOrderToFormState(
  doc: CrmProductionOrderDoc,
): ProductionOrderFormState {
  return {
    orderNo: doc.orderNo,
    bomId: doc.bomId ?? null,
    bomLabel: doc.bomId ? (doc.bomRef ?? 'BOM') : null,
    bomRef: doc.bomRef ?? '',
    finishedGoodId: doc.finishedGoodId ?? null,
    finishedGoodLabel: doc.finishedGoodId ? doc.finishedGoodName : null,
    finishedGoodName: doc.finishedGoodName ?? '',
    plannedQty: String(doc.plannedQty ?? 1),
    unit: doc.unit ?? 'unit',
    plannedStart: (doc.plannedStart ?? '').slice(0, 10),
    plannedEnd: (doc.plannedEnd ?? '').slice(0, 10),
    machineId: doc.machineId ?? '',
    machineOperatorId: doc.machineOperatorId ?? null,
    machineOperatorLabel: doc.machineOperatorId
      ? (doc.machineOperator ?? null)
      : null,
    machineOperator: doc.machineOperator ?? '',
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

export function stateToInput(
  s: ProductionOrderFormState,
): SabcrmProductionOrderFullInput {
  return {
    orderNo: s.orderNo.trim(),
    bomId: s.bomId || undefined,
    bomRef: s.bomRef.trim() || undefined,
    finishedGoodId: s.finishedGoodId || undefined,
    finishedGoodName: s.finishedGoodName.trim(),
    plannedQty: Number(s.plannedQty) || 0,
    unit: s.unit.trim(),
    plannedStart: s.plannedStart || undefined,
    plannedEnd: s.plannedEnd || undefined,
    machineId: s.machineId.trim() || undefined,
    machineOperator: s.machineOperator.trim() || undefined,
    machineOperatorId: s.machineOperatorId || undefined,
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
        costPerUnit: c.costPerUnit,
      })),
  };
}

/* ─── Drawer ───────────────────────────────────────────────────── */

export interface ProductionOrderFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  initialState?: ProductionOrderFormState;
  onSubmit: (
    input: SabcrmProductionOrderFullInput,
  ) => Promise<{ ok: boolean; error?: string }>;
}

export function ProductionOrderForm({
  open,
  onOpenChange,
  mode,
  initialState,
  onSubmit,
}: ProductionOrderFormProps): React.JSX.Element {
  const [state, setState] = React.useState<ProductionOrderFormState>(
    () => initialState ?? emptyState(),
  );
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [bomLoading, setBomLoading] = React.useState(false);
  const seeded = React.useRef(false);

  React.useEffect(() => {
    if (!open) return;
    setState(initialState ?? emptyState());
    setError(null);
    seeded.current = false;
  }, [open, initialState]);

  React.useEffect(() => {
    if (!open || mode !== 'create' || seeded.current) return;
    if ((initialState?.orderNo ?? '').trim()) return;
    seeded.current = true;
    let cancelled = false;
    void suggestNextSupplyNumber('production-order').then((res) => {
      if (cancelled || !res.ok || !res.data) return;
      setState((s) => (s.orderNo.trim() ? s : { ...s, orderNo: res.data }));
    });
    return () => {
      cancelled = true;
    };
  }, [open, mode, initialState]);

  const patch = (p: Partial<ProductionOrderFormState>): void =>
    setState((s) => ({ ...s, ...p }));

  const applyBom = (bomId: string | null, bomLabel: string | null): void => {
    if (!bomId) {
      patch({ bomId: null, bomLabel: null, bomRef: '' });
      return;
    }
    patch({ bomId, bomLabel });
    setBomLoading(true);
    void getSabcrmSupplyProductionOrderBomPrefill(bomId)
      .then((res) => {
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        const p = res.data;
        setState((s) => ({
          ...s,
          bomId,
          bomLabel,
          bomRef: p.bomRef,
          finishedGoodId: p.finishedGoodId,
          finishedGoodLabel: p.finishedGoodId ? p.finishedGoodName : null,
          finishedGoodName: p.finishedGoodName,
          unit: p.unit,
          plannedQty: s.plannedQty || String(p.outputQty),
          labourCost:
            p.labourCost === undefined ? s.labourCost : String(p.labourCost),
          overheadCost:
            p.overheadCost === undefined
              ? s.overheadCost
              : String(p.overheadCost),
          components:
            p.components.length > 0
              ? p.components.map((c, i) => ({
                  rowId: `bom-${i}`,
                  itemId: c.itemId,
                  itemName: c.itemName,
                  qty: c.qty,
                  unit: c.unit,
                  scrapPct: c.scrapPct,
                  costPerUnit: c.costPerUnit,
                }))
              : s.components,
        }));
      })
      .finally(() => setBomLoading(false));
  };

  const validate = (): string | null => {
    if (!state.orderNo.trim()) return 'An order number is required.';
    if (!state.finishedGoodName.trim()) {
      return 'A finished-good name is required.';
    }
    if (!(Number(state.plannedQty) > 0)) {
      return 'The planned quantity must be greater than zero.';
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
      const res = await onSubmit(stateToInput(state));
      if (!res.ok) {
        setError(res.error ?? 'Something went wrong.');
        return;
      }
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  };

  const busy = pending || bomLoading;

  return (
    <Drawer open={open} onOpenChange={(n) => !pending && onOpenChange(n)} side="right">
      <DrawerContent aria-describedby="mo-form-desc" className="fdoc-form-drawer">
        <DrawerHeader>
          <DrawerTitle>
            {mode === 'create' ? 'New production order' : 'Edit production order'}
          </DrawerTitle>
          <DrawerDescription id="mo-form-desc">
            Plan a manufacturing run — pick a BOM to prefill the recipe, set the
            planned quantity and schedule.
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
              <Field label="Order number" required>
                <Input
                  value={state.orderNo}
                  onChange={(e) => patch({ orderNo: e.target.value })}
                  placeholder="MO-2026-0001"
                  disabled={busy}
                />
              </Field>
              <Field label="Bill of materials" help="Picking prefills the recipe.">
                <EntityPicker
                  value={state.bomId}
                  valueLabel={state.bomLabel}
                  search={async (q) => {
                    const res = await searchSabcrmSupplyBoms(q);
                    return res.ok ? res.data : [];
                  }}
                  placeholder="Search BOMs…"
                  disabled={busy}
                  onChange={(opt) => applyBom(opt?.id ?? null, opt?.label ?? null)}
                />
              </Field>

              <Field label="Finished good (catalog)">
                <EntityPicker
                  value={state.finishedGoodId}
                  valueLabel={state.finishedGoodLabel}
                  search={async (q) => {
                    const res = await searchSabcrmSupplyItemOptions(q);
                    return res.ok ? res.data : [];
                  }}
                  placeholder="Search items…"
                  disabled={busy}
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
                  disabled={busy}
                />
              </Field>

              <Field label="Planned quantity" required>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={state.plannedQty}
                  onChange={(e) => patch({ plannedQty: e.target.value })}
                  disabled={busy}
                />
              </Field>
              <Field label="Unit" required>
                <Input
                  value={state.unit}
                  onChange={(e) => patch({ unit: e.target.value })}
                  placeholder="unit"
                  disabled={busy}
                />
              </Field>

              <Field label="Planned start">
                <DatePicker
                  value={keyToDate(state.plannedStart)}
                  onChange={(d) => patch({ plannedStart: dateToKey(d) })}
                  placeholder="Pick a date"
                  disabled={busy}
                  aria-label="Planned start"
                />
              </Field>
              <Field label="Planned end">
                <DatePicker
                  value={keyToDate(state.plannedEnd)}
                  onChange={(d) => patch({ plannedEnd: dateToKey(d) })}
                  placeholder="Pick a date"
                  disabled={busy}
                  aria-label="Planned end"
                />
              </Field>

              <Field label="Machine / work centre">
                <Input
                  value={state.machineId}
                  onChange={(e) => patch({ machineId: e.target.value })}
                  placeholder="CNC-01"
                  disabled={busy}
                />
              </Field>
              <Field label="Operator" help="Optional — who runs this order.">
                <EntityPicker
                  value={state.machineOperatorId}
                  valueLabel={state.machineOperatorLabel}
                  search={async (q) => {
                    const res = await searchSabcrmEmployees(q);
                    return res.ok ? res.data : [];
                  }}
                  placeholder="Search employees…"
                  disabled={busy}
                  onChange={(opt) =>
                    patch({
                      machineOperatorId: opt?.id ?? null,
                      machineOperatorLabel: opt?.label ?? null,
                      machineOperator: opt?.label ?? '',
                    })
                  }
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
                  disabled={busy}
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
                  disabled={busy}
                />
              </Field>

              <div className="fdoc-form-grid__full">
                <Field label="Components" required>
                  <BomComponentsEditor
                    components={state.components}
                    onChange={(components) => patch({ components })}
                    disabled={busy}
                    showOptional={false}
                  />
                </Field>
              </div>

              <div className="fdoc-form-grid__full">
                <Field label="Notes">
                  <Textarea
                    value={state.notes}
                    onChange={(e) => patch({ notes: e.target.value })}
                    rows={3}
                    placeholder="Shift notes, routing instructions…"
                    disabled={busy}
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
            <Button type="submit" variant="primary" loading={pending} disabled={bomLoading}>
              {mode === 'create' ? 'Create order' : 'Save changes'}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
