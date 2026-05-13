'use client';

import { useState, useEffect, useActionState, useMemo } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, LoaderCircle, Plus, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

import {
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruTextarea,
  ZoruSeparator,
  useZoruToast,
} from '@/components/zoruui';
import { saveBom } from '@/app/actions/crm-bom.actions';
import { EntityFormField } from '@/components/crm/entity-form-field';

type ComponentRow = {
  id: string;
  itemId: string;
  itemName: string;
  qty: number;
  unit: string;
  scrapPct: number;
};

const initialState = { message: '', error: '', id: '' };

export interface BomEditFormProps {
  initial: {
    _id: string;
    bomNo?: string;
    finishedGoodId?: string;
    finishedGoodName?: string;
    outputQty?: number;
    unit?: string;
    effectiveDate?: string;
    version?: string;
    notes?: string;
    components?: { itemId?: string; itemName: string; qty: number; unit: string; scrapPct: number }[];
  };
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      Save BOM
    </ZoruButton>
  );
}

function toDateInput(value: string | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export function BomEditForm({ initial }: BomEditFormProps) {
  const [state, formAction] = useActionState(saveBom, initialState);
  const router = useRouter();
  const { toast } = useZoruToast();

  const seedComponents = useMemo<ComponentRow[]>(() => {
    const seed = Array.isArray(initial.components) ? initial.components : [];
    if (seed.length === 0) {
      return [{ id: uuidv4(), itemId: '', itemName: '', qty: 1, unit: '', scrapPct: 0 }];
    }
    return seed.map((c) => ({
      id: uuidv4(),
      itemId: c.itemId ?? '',
      itemName: c.itemName ?? '',
      qty: typeof c.qty === 'number' ? c.qty : 1,
      unit: c.unit ?? '',
      scrapPct: typeof c.scrapPct === 'number' ? c.scrapPct : 0,
    }));
  }, [initial.components]);

  const [components, setComponents] = useState<ComponentRow[]>(seedComponents);

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success!', description: state.message });
      router.push(`/dashboard/crm/inventory/bom/${initial._id}`);
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router, initial._id]);

  const addComponent = () => {
    setComponents((prev) => [
      ...prev,
      { id: uuidv4(), itemId: '', itemName: '', qty: 1, unit: '', scrapPct: 0 },
    ]);
  };

  const removeComponent = (id: string) => {
    setComponents((prev) => prev.filter((c) => c.id !== id));
  };

  const updateComponent = <K extends keyof ComponentRow>(
    id: string,
    field: K,
    value: ComponentRow[K],
  ) => {
    setComponents((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)),
    );
  };

  const componentsForSubmit = components.map(({ itemId, itemName, qty, unit, scrapPct }) => ({
    itemId,
    itemName,
    qty,
    unit,
    scrapPct,
  }));

  return (
    <form action={formAction}>
      <input type="hidden" name="bomId" value={initial._id} />
      <input type="hidden" name="components" value={JSON.stringify(componentsForSubmit)} />

      <div className="flex w-full flex-col gap-6">
        <div className="flex items-center justify-between">
          <ZoruButton variant="outline" size="sm" asChild>
            <Link href={`/dashboard/crm/inventory/bom/${initial._id}`}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
          </ZoruButton>
          <SubmitButton />
        </div>

        <ZoruCard className="p-6">
          <h2 className="mb-4 text-[16px] text-zoru-ink">BOM Details</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <ZoruLabel htmlFor="bomNo" className="text-xs text-zoru-ink">
                BOM No.
              </ZoruLabel>
              <ZoruInput
                id="bomNo"
                name="bomNo"
                defaultValue={initial.bomNo || ''}
                placeholder="Auto-generated if blank"
                className="h-9"
                maxLength={64}
              />
            </div>

            <div className="space-y-1">
              <ZoruLabel htmlFor="finishedGoodName" className="text-xs text-zoru-ink">
                Finished Good *
              </ZoruLabel>
              <EntityFormField
                entity="item"
                name="finishedGoodId"
                dualWriteName="finishedGoodName"
                initialId={initial.finishedGoodId || null}
                initialLabel={initial.finishedGoodName || ''}
                required
              />
            </div>

            <div className="space-y-1">
              <ZoruLabel htmlFor="outputQty" className="text-xs text-zoru-ink">
                Output Qty
              </ZoruLabel>
              <ZoruInput
                id="outputQty"
                name="outputQty"
                type="number"
                min={0}
                step="any"
                defaultValue={initial.outputQty ?? 1}
                className="h-9"
              />
            </div>

            <div className="space-y-1">
              <ZoruLabel htmlFor="unit" className="text-xs text-zoru-ink">
                Unit
              </ZoruLabel>
              <EntityFormField
                entity="unit"
                name="unit"
                initialLabel={initial.unit || ''}
                placeholder="e.g. PCS"
              />
            </div>

            <div className="space-y-1">
              <ZoruLabel htmlFor="effectiveDate" className="text-xs text-zoru-ink">
                Effective Date
              </ZoruLabel>
              <ZoruInput
                id="effectiveDate"
                name="effectiveDate"
                type="date"
                defaultValue={toDateInput(initial.effectiveDate)}
                className="h-9"
              />
            </div>

            <div className="space-y-1">
              <ZoruLabel htmlFor="version" className="text-xs text-zoru-ink">
                Version
              </ZoruLabel>
              <ZoruInput
                id="version"
                name="version"
                defaultValue={initial.version || '1.0'}
                className="h-9"
                maxLength={32}
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <ZoruLabel htmlFor="notes" className="text-xs text-zoru-ink">
                Notes
              </ZoruLabel>
              <ZoruTextarea
                id="notes"
                name="notes"
                defaultValue={initial.notes || ''}
                placeholder="Any additional notes…"
                rows={3}
              />
            </div>
          </div>
        </ZoruCard>

        <ZoruCard className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-[16px] text-zoru-ink">Components</h2>
              <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                Add each raw material or sub-assembly needed to produce the finished good.
              </p>
            </div>
            <ZoruButton type="button" variant="outline" size="sm" onClick={addComponent}>
              <Plus className="h-4 w-4" /> Add Component
            </ZoruButton>
          </div>

          <ZoruSeparator className="mb-4" />

          <div className="overflow-x-auto rounded-lg border border-zoru-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zoru-line bg-zoru-surface-2">
                  <th className="px-3 py-2 text-left text-xs font-medium text-zoru-ink-muted">
                    Item Name
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-zoru-ink-muted">
                    Qty
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-zoru-ink-muted">
                    Unit
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-zoru-ink-muted">
                    Scrap %
                  </th>
                  <th className="w-10 px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {components.map((row, idx) => (
                  <tr key={row.id} className="border-b border-zoru-line last:border-0">
                    <td className="px-2 py-2">
                      <EntityFormField
                        entity="item"
                        name={`__bom-item-${row.id}`}
                        initialId={row.itemId || null}
                        initialLabel={row.itemName}
                        placeholder={`Component ${idx + 1}`}
                        onChange={(id, hydrated) => {
                          setComponents((prev) => prev.map((c) => c.id === row.id
                            ? { ...c, itemId: id ?? '', itemName: hydrated?.chip.primary ?? c.itemName }
                            : c));
                        }}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <ZoruInput
                        type="number"
                        min={0}
                        step="any"
                        value={row.qty}
                        onChange={(e) =>
                          updateComponent(row.id, 'qty', parseFloat(e.target.value) || 0)
                        }
                        className="h-8 w-24"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <EntityFormField
                        entity="unit"
                        name={`__bom-unit-${row.id}`}
                        initialLabel={row.unit}
                        placeholder="PCS"
                        onChange={(_id, hydrated) => {
                          updateComponent(row.id, 'unit', hydrated?.chip.primary ?? '');
                        }}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <ZoruInput
                        type="number"
                        min={0}
                        max={100}
                        step="any"
                        value={row.scrapPct}
                        onChange={(e) =>
                          updateComponent(row.id, 'scrapPct', parseFloat(e.target.value) || 0)
                        }
                        className="h-8 w-24"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <ZoruButton
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Remove component"
                        onClick={() => removeComponent(row.id)}
                        disabled={components.length === 1}
                      >
                        <Trash2 className="h-4 w-4 text-zoru-danger-ink" />
                      </ZoruButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3">
            <ZoruButton type="button" variant="outline" size="sm" onClick={addComponent}>
              <Plus className="h-4 w-4" /> Add Component
            </ZoruButton>
          </div>
        </ZoruCard>
      </div>
    </form>
  );
}
