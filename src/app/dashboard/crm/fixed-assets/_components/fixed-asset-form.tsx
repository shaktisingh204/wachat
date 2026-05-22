'use client';

import {
  Button,
  Card,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  useZoruToast,
} from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LoaderCircle } from 'lucide-react';

/**
 * <FixedAssetForm> — single source of truth for both Create and Edit
 * flows.
 *
 * Server-action driven via `saveFixedAssetAction`. Relational fields
 * (vendor, custodian employee, warehouse) are encoded as
 * `<EntityFormField>` so the value stored is an id. `fixedAsset` is
 * NOT a member of `WsCustomFieldBelongsTo`, so this form deliberately
 * skips the custom-fields panel.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { saveFixedAssetAction } from '@/app/actions/crm/fixed-assets.actions';
import type { CrmFixedAssetDoc } from '@/lib/rust-client/crm-fixed-assets';

interface FixedAssetFormProps {
  /** Existing asset — present in Edit mode, omit for Create. */
  initial?: CrmFixedAssetDoc | null;
}

const DEPRECIATION_METHODS = [
  { value: 'slm', label: 'Straight-line (SLM)' },
  { value: 'wdv', label: 'Written-down value (WDV)' },
  { value: 'units', label: 'Units of production' },
];

const CONDITIONS = [
  { value: 'new', label: 'New' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'retired', label: 'Retired' },
];

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {editing ? 'Save changes' : 'Create fixed asset'}
    </Button>
  );
}

const INITIAL_STATE = { message: undefined, error: undefined, id: undefined };

/** Slice an ISO timestamp down to `YYYY-MM-DD` for `<input type="date">`. */
function toDateInputValue(v?: string): string {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export function FixedAssetForm({ initial }: FixedAssetFormProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(saveFixedAssetAction, INITIAL_STATE);

  const editing = !!initial?._id;

  // Controlled Select values (Radix select doesn't expose a
  // defaultValue that gets serialized into FormData on submit — we
  // mirror to hidden inputs).
  const [depreciationMethod, setDepreciationMethod] = React.useState<string>(
    initial?.depreciationMethod ? String(initial.depreciationMethod) : 'slm',
  );
  const [condition, setCondition] = React.useState<string>(
    initial?.condition ? String(initial.condition) : 'new',
  );

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      router.push(
        state.id
          ? `/dashboard/crm/fixed-assets/${state.id}`
          : '/dashboard/crm/fixed-assets',
      );
    }
    if (state?.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router]);

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      {editing ? <input type="hidden" name="_id" value={String(initial!._id)} /> : null}
      {/* Select → hidden input bridge for FormData. */}
      <input type="hidden" name="depreciationMethod" value={depreciationMethod} />
      <input type="hidden" name="condition" value={condition} />

      <Card className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Header
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="code">
              Asset code <span className="text-zoru-danger-ink">*</span>
            </Label>
            <Input
              id="code"
              name="code"
              required
              defaultValue={initial?.code ?? ''}
              className="mt-1.5"
              placeholder="LAP-2026-014"
            />
          </div>
          <div>
            <Label htmlFor="name">
              Asset name <span className="text-zoru-danger-ink">*</span>
            </Label>
            <Input
              id="name"
              name="name"
              required
              defaultValue={initial?.name ?? ''}
              className="mt-1.5"
              placeholder="ThinkPad X1 Carbon"
            />
          </div>
          <div>
            <Label>Category</Label>
            <div className="mt-1.5">
              <EntityFormField
                entity="category"
                name="category"
                initialId={initial?.category ?? null}
                placeholder="Select category…"
              />
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Purchase
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="purchaseDate">
              Purchase date{' '}
              {!editing ? <span className="text-zoru-danger-ink">*</span> : null}
            </Label>
            <Input
              id="purchaseDate"
              name="purchaseDate"
              type="date"
              required={!editing}
              defaultValue={toDateInputValue(initial?.purchaseDate)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="cost">
              Purchase value{' '}
              {!editing ? <span className="text-zoru-danger-ink">*</span> : null}
            </Label>
            <Input
              id="cost"
              name="cost"
              type="number"
              step="0.01"
              min={0}
              required={!editing}
              defaultValue={initial?.cost ?? ''}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Currency</Label>
            <div className="mt-1.5">
              <EntityFormField
                entity="currency"
                name="currency"
                initialId={initial?.currency ?? 'INR'}
              />
            </div>
          </div>
          <div>
            <Label>Vendor (purchased from)</Label>
            <div className="mt-1.5">
              <EntityFormField
                entity="vendor"
                name="supplierId"
                initialId={initial?.supplierId ?? null}
              />
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Assignment
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Custodian (assigned employee)</Label>
            <div className="mt-1.5">
              <EntityFormField
                entity="employee"
                name="custodianEmployeeId"
                initialId={initial?.custodianEmployeeId ?? null}
              />
            </div>
          </div>
          <div>
            <Label>Location (branch)</Label>
            <div className="mt-1.5">
              <EntityFormField
                entity="branch"
                name="location"
                initialId={initial?.location ?? null}
                placeholder="Select branch…"
              />
            </div>
          </div>
          <div>
            <Label>Warehouse</Label>
            <div className="mt-1.5">
              {/*
               * The Rust DTO doesn't carry a warehouseId for fixed
               * assets, so we don't post this value. Kept here as a
               * picker placeholder per the form spec — it's purely
               * advisory until the Rust schema picks up a warehouse
               * column.
               */}
              <EntityFormField
                entity="warehouse"
                name="_warehouseId_unused"
                initialId={null}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="warrantyUntil">Warranty until</Label>
            <Input
              id="warrantyUntil"
              name="warrantyUntil"
              type="date"
              defaultValue={toDateInputValue(initial?.warrantyUntil)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="insuranceUntil">Insurance until</Label>
            <Input
              id="insuranceUntil"
              name="insuranceUntil"
              type="date"
              defaultValue={toDateInputValue(initial?.insuranceUntil)}
              className="mt-1.5"
            />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Depreciation
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="depreciationMethod">Depreciation method</Label>
            <Select value={depreciationMethod} onValueChange={setDepreciationMethod}>
              <ZoruSelectTrigger id="depreciationMethod" className="mt-1.5">
                <ZoruSelectValue placeholder="Select method" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {DEPRECIATION_METHODS.map((m) => (
                  <ZoruSelectItem key={m.value} value={m.value}>
                    {m.label}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="usefulLifeMonths">
              Useful life (months){' '}
              {!editing ? <span className="text-zoru-danger-ink">*</span> : null}
            </Label>
            <Input
              id="usefulLifeMonths"
              name="usefulLifeMonths"
              type="number"
              min={1}
              step={1}
              required={!editing}
              defaultValue={initial?.usefulLifeMonths ?? ''}
              className="mt-1.5"
              placeholder="48"
            />
          </div>
          <div>
            <Label htmlFor="residualValue">Residual value</Label>
            <Input
              id="residualValue"
              name="residualValue"
              type="number"
              step="0.01"
              min={0}
              defaultValue={initial?.residualValue ?? ''}
              className="mt-1.5"
            />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Status
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="condition">Condition</Label>
            <Select value={condition} onValueChange={setCondition}>
              <ZoruSelectTrigger id="condition" className="mt-1.5">
                <ZoruSelectValue placeholder="Select condition" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {CONDITIONS.map((c) => (
                  <ZoruSelectItem key={c.value} value={c.value}>
                    {c.label}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link
            href={
              editing
                ? `/dashboard/crm/fixed-assets/${String(initial!._id)}`
                : '/dashboard/crm/fixed-assets'
            }
          >
            Cancel
          </Link>
        </Button>
        <SubmitButton editing={editing} />
      </div>
    </form>
  );
}
