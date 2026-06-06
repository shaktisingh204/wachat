'use client';

import { Button, Card, Input, Label, Textarea, useZoruToast } from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LoaderCircle,
  Plus,
  Trash2 } from 'lucide-react';

/**
 * <GrnForm> — single source of truth for both Create and Edit flows.
 * Server-action driven via `saveGrnAction`.
 *
 * Layout:
 *   1. Header — GRN number, vendor / warehouse (via <EntityFormField>),
 *      receipt date, optional linked PO (via <EntityFormField entity="purchaseOrder">).
 *   2. Line Items — editable rows (item via <EntityFormField>,
 *      ordered / received / accepted / rejected quantities, optional
 *      batch + expiry + serial numbers).
 *   3. Inspector + Notes — inspector via <EntityFormField entity="user">.
 *   4. Status — workflow status select.
 *
 * GRNs intentionally skip the custom-field panel — `'grn'` is not a
 * registered `WsCustomFieldBelongsTo` key.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { saveGrnAction } from '@/app/actions/crm/grns.actions';
import type {
  CrmGrnDoc,
  CrmGrnLineItem,
  CrmGrnStatus,
} from '@/lib/rust-client/crm-grns';

export interface GrnFormSeed {
  /** Vendor pre-fill (from a PO conversion). */
  vendorId?: string;
  /** Warehouse pre-fill (from a PO conversion). */
  warehouseId?: string;
  /** PO id pre-fill (from a PO conversion). */
  poId?: string;
  /** Optional line-item seeds (carried over from the parent PO). */
  items?: Array<{
    itemId: string;
    orderedQty: number;
  }>;
}

interface GrnFormProps {
  /** Existing GRN — present in Edit mode, omit for Create. */
  initial?: CrmGrnDoc | null;
  /** Optional pre-fill from a parent PO (PO→GRN conversion). */
  seed?: GrnFormSeed;
}

const STATUS_OPTIONS: ReadonlyArray<{
  value: CrmGrnStatus;
  label: string;
}> = [
  { value: 'draft', label: 'Draft' },
  { value: 'inspected', label: 'Inspected' },
  { value: 'posted', label: 'Posted' },
  { value: 'rejected', label: 'Rejected' },
];

/** Editable line-item row. Strings throughout so the inputs stay
 *  controlled cleanly; we coerce to numbers when serialising. */
interface DraftLine {
  /** Stable local id for React keys; never sent to the server. */
  key: string;
  itemId: string;
  orderedQty: string;
  receivedQty: string;
  acceptedQty: string;
  rejectedQty: string;
  batch: string;
  expiry: string;
  serialNos: string;
}

function newLine(seed?: Partial<DraftLine>): DraftLine {
  return {
    key:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `line-${Math.random().toString(36).slice(2)}`,
    itemId: seed?.itemId ?? '',
    orderedQty: seed?.orderedQty ?? '',
    receivedQty: seed?.receivedQty ?? '',
    acceptedQty: seed?.acceptedQty ?? '',
    rejectedQty: seed?.rejectedQty ?? '',
    batch: seed?.batch ?? '',
    expiry: seed?.expiry ?? '',
    serialNos: seed?.serialNos ?? '',
  };
}

function lineFromDoc(it: CrmGrnLineItem): DraftLine {
  return newLine({
    itemId: it.itemId ?? '',
    orderedQty: Number.isFinite(it.orderedQty) ? String(it.orderedQty) : '',
    receivedQty: Number.isFinite(it.receivedQty) ? String(it.receivedQty) : '',
    acceptedQty: Number.isFinite(it.acceptedQty) ? String(it.acceptedQty) : '',
    rejectedQty: Number.isFinite(it.rejectedQty) ? String(it.rejectedQty) : '',
    batch: it.batch ?? '',
    expiry: it.expiry
      ? new Date(it.expiry).toISOString().slice(0, 10)
      : '',
    serialNos: Array.isArray(it.serialNos) ? it.serialNos.join(', ') : '',
  });
}

function toNum(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {editing ? 'Save changes' : 'Create GRN'}
    </Button>
  );
}

const INITIAL_STATE = { message: undefined, error: undefined, id: undefined };

export function GrnForm({ initial, seed }: GrnFormProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(saveGrnAction, INITIAL_STATE);

  const editing = !!initial?._id;

  const [status, setStatus] = useState<string>(
    typeof initial?.status === 'string' ? initial.status : 'draft',
  );
  const [lines, setLines] = useState<DraftLine[]>(() => {
    if (initial?.items && initial.items.length > 0) {
      return initial.items.map(lineFromDoc);
    }
    if (seed?.items && seed.items.length > 0) {
      return seed.items.map((it) =>
        newLine({
          itemId: it.itemId,
          orderedQty: Number.isFinite(it.orderedQty)
            ? String(it.orderedQty)
            : '',
          receivedQty: Number.isFinite(it.orderedQty)
            ? String(it.orderedQty)
            : '',
          acceptedQty: Number.isFinite(it.orderedQty)
            ? String(it.orderedQty)
            : '',
        }),
      );
    }
    return [newLine()];
  });

  // Serialise lines for the hidden `items` field so the server action
  // can rebuild the wire shape without re-doing per-input parsing.
  const itemsPayload = lines
    .filter((l) => l.itemId.trim().length > 0)
    .map((l) => ({
      itemId: l.itemId,
      orderedQty: toNum(l.orderedQty),
      receivedQty: toNum(l.receivedQty),
      acceptedQty: toNum(l.acceptedQty),
      rejectedQty: toNum(l.rejectedQty),
      batch: l.batch.trim() || undefined,
      expiry: l.expiry ? `${l.expiry}T00:00:00Z` : undefined,
      serialNos: l.serialNos
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    }));

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      router.push(
        state.id
          ? `/dashboard/crm/inventory/grn/${state.id}`
          : '/dashboard/crm/inventory/grn',
      );
    }
    if (state?.error) {
      toast({
        title: 'Error',
        description: state.error,
        variant: 'destructive',
      });
    }
  }, [state, toast, router]);

  const addLine = () => setLines((prev) => [...prev, newLine()]);
  const removeLine = (key: string) =>
    setLines((prev) =>
      prev.length > 1 ? prev.filter((l) => l.key !== key) : prev,
    );
  const updateLine = (key: string, patch: Partial<DraftLine>) =>
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    );

  const defaultDate = initial?.date
    ? new Date(initial.date).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      {editing ? (
        <input type="hidden" name="_id" value={String(initial!._id)} />
      ) : null}
      <input type="hidden" name="items" value={JSON.stringify(itemsPayload)} />
      <input type="hidden" name="status" value={status} />

      {/* ─── Header ─────────────────────────────────────────────── */}
      <Card className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Header
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="grnNo">
              GRN number <span className="text-[var(--st-danger)]">*</span>
            </Label>
            <Input
              id="grnNo"
              name="grnNo"
              required={!editing}
              readOnly={editing}
              defaultValue={initial?.grnNo ?? ''}
              placeholder="GRN-2026-0001"
              className="mt-1.5"
            />
            {editing ? (
              <p className="mt-1 text-[11px] text-[var(--st-text-secondary)]">
                GRN numbers are immutable — they identify the receipt on
                printed paperwork.
              </p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="date">
              Receipt date <span className="text-[var(--st-danger)]">*</span>
            </Label>
            <Input
              id="date"
              name="date"
              type="date"
              required
              defaultValue={defaultDate}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>
              Vendor <span className="text-[var(--st-danger)]">*</span>
            </Label>
            <div className="mt-1.5">
              <EntityFormField
                entity="vendor"
                name="vendorId"
                initialId={initial?.vendorId ?? seed?.vendorId ?? null}
                required
              />
            </div>
          </div>
          <div>
            <Label>
              Warehouse <span className="text-[var(--st-danger)]">*</span>
            </Label>
            <div className="mt-1.5">
              <EntityFormField
                entity="warehouse"
                name="warehouseId"
                initialId={initial?.warehouseId ?? seed?.warehouseId ?? null}
                required
              />
            </div>
          </div>
          <div className="md:col-span-2">
            <Label>Linked Purchase Order</Label>
            <div className="mt-1.5">
              {editing || seed?.poId ? (
                <input
                  type="hidden"
                  name="poId"
                  value={initial?.poId ?? seed?.poId ?? ''}
                />
              ) : (
                <EntityFormField
                  entity="purchaseOrder"
                  name="poId"
                  initialId={initial?.poId ?? seed?.poId ?? null}
                  placeholder="Pick a Purchase Order…"
                />
              )}
              {(editing || seed?.poId) && (initial?.poId || seed?.poId) ? (
                <p className="text-[12px] text-[var(--st-text)]">
                  Linked: <span className="font-mono">{initial?.poId ?? seed?.poId}</span>
                </p>
              ) : null}
            </div>
            <p className="mt-1 text-[11px] text-[var(--st-text-secondary)]">
              {editing
                ? 'The PO link is set at create time and is not editable here.'
                : seed?.poId
                  ? 'Pre-filled from the source Purchase Order.'
                  : 'Leave blank for a direct receipt with no parent PO.'}
            </p>
          </div>
        </div>
      </Card>

      {/* ─── Line Items ─────────────────────────────────────────── */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
            Line items
          </h3>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addLine}
          >
            <Plus className="h-3.5 w-3.5" />
            Add line
          </Button>
        </div>

        <div className="space-y-4">
          {lines.map((line, idx) => (
            <div
              key={line.key}
              className="rounded-lg border border-[var(--st-border)] p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                  Line {String(idx + 1).padStart(2, '0')}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={lines.length === 1}
                  onClick={() => removeLine(line.key)}
                  className="text-[var(--st-danger)]"
                  aria-label="Remove line"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label>Item</Label>
                  <div className="mt-1.5">
                    <EntityFormField
                      entity="item"
                      name={`item-${line.key}`}
                      initialId={line.itemId || null}
                      onChange={(next) =>
                        updateLine(line.key, { itemId: next ?? '' })
                      }
                    />
                  </div>
                </div>

                <div>
                  <Label>Ordered qty</Label>
                  <Input
                    type="number"
                    step="any"
                    min={0}
                    value={line.orderedQty}
                    onChange={(e) =>
                      updateLine(line.key, { orderedQty: e.target.value })
                    }
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Received qty</Label>
                  <Input
                    type="number"
                    step="any"
                    min={0}
                    value={line.receivedQty}
                    onChange={(e) =>
                      updateLine(line.key, { receivedQty: e.target.value })
                    }
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Accepted qty</Label>
                  <Input
                    type="number"
                    step="any"
                    min={0}
                    value={line.acceptedQty}
                    onChange={(e) =>
                      updateLine(line.key, { acceptedQty: e.target.value })
                    }
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Rejected qty (damaged/short)</Label>
                  <Input
                    type="number"
                    step="any"
                    min={0}
                    value={line.rejectedQty}
                    onChange={(e) =>
                      updateLine(line.key, { rejectedQty: e.target.value })
                    }
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label>Batch / lot</Label>
                  <Input
                    value={line.batch}
                    onChange={(e) =>
                      updateLine(line.key, { batch: e.target.value })
                    }
                    placeholder="BATCH-A"
                    maxLength={120}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Expiry</Label>
                  <Input
                    type="date"
                    value={line.expiry}
                    onChange={(e) =>
                      updateLine(line.key, { expiry: e.target.value })
                    }
                    className="mt-1.5"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Serial numbers (comma-separated)</Label>
                  <Input
                    value={line.serialNos}
                    onChange={(e) =>
                      updateLine(line.key, { serialNos: e.target.value })
                    }
                    placeholder="SN-001, SN-002"
                    className="mt-1.5"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ─── Inspector + Workflow ───────────────────────────────── */}
      <Card className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Workflow
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Inspector</Label>
            <div className="mt-1.5">
              <EntityFormField
                entity="user"
                name="inspectorId"
                initialId={initial?.inspectorId ?? null}
              />
            </div>
          </div>
          <div>
            <Label>Status</Label>
            <div className="mt-1.5">
              <EnumFormField
                enumName="grnStatus"
                name="__status_picker"
                initialId={status || null}
                placeholder="Select status"
                onChange={(id) => setStatus((id ?? 'draft') as CrmGrnStatus)}
              />
            </div>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="notes">Inspection notes</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              className="mt-1.5"
              placeholder="Notes captured during inspection (optional, not persisted server-side yet)."
            />
            <p className="mt-1 text-[11px] text-[var(--st-text-secondary)]">
              Free-text inspector notes — visible only on this form for now.
            </p>
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link
            href={
              editing
                ? `/dashboard/crm/inventory/grn/${String(initial!._id)}`
                : '/dashboard/crm/inventory/grn'
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
