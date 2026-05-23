'use client';

import { Button, Card, Input, Label, Textarea, useZoruToast } from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter,
  useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { LoaderCircle,
  Plus,
  Trash2,
  Upload,
  X } from 'lucide-react';

/**
 * <RfqForm> — single source of truth for both Create and Edit flows.
 * Server-action driven via `saveRfqAction`.
 *
 * Layout:
 *   1. Header — title, required-by, deadline.
 *   2. Vendors invited — multi-select via `<EntityPicker entity="vendor" multi>`.
 *   3. Line Items — editable table (item picker + qty + unit + specs +
 *      free-form description). NO prices — RFQ lines are
 *      request-for-bid only; pricing lives on the matching VendorBid.
 *   4. Workflow — status select + free-form terms + SabFile attachments.
 *
 * RFQs intentionally skip the custom-field panel — `'rfq'` is not a
 * registered `WsCustomFieldBelongsTo` key.
 *
 * NB: vendors / items / attachments are JSON-encoded in hidden inputs
 * so the server action can rebuild the wire shape. Files come from
 * `<SabFilePickerButton>` only — per the project SabFiles policy we
 * never expose a free-text URL paste.
 */

import * as React from 'react';

import { EntityPicker } from '@/components/crm/entity-picker';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { SabFilePickerButton } from '@/components/sabfiles';
import { saveRfqAction } from '@/app/actions/crm/rfqs.actions';
import type {
  CrmRfqAttachment,
  CrmRfqDoc,
  CrmRfqLineItem,
  CrmRfqStatus,
} from '@/lib/rust-client/crm-rfqs';
import type { LookupItem } from '@/lib/lookup-registry';

interface RfqFormProps {
  /** Existing RFQ — present in Edit mode, omit for Create. */
  initial?: CrmRfqDoc | null;
}

const STATUS_OPTIONS: ReadonlyArray<{
  value: CrmRfqStatus;
  label: string;
}> = [
  { value: 'draft', label: 'Draft' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'awarded', label: 'Awarded' },
  { value: 'cancelled', label: 'Cancelled' },
];

/** Editable line-item row — id-bound for stable React keys. */
interface DraftLine {
  /** Stable local id for React keys; never sent to the server. */
  key: string;
  itemId: string;
  description: string;
  qty: string;
  unit: string;
  specs: string;
}

function newLine(seed?: Partial<DraftLine>): DraftLine {
  return {
    key:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `line-${Math.random().toString(36).slice(2)}`,
    itemId: seed?.itemId ?? '',
    description: seed?.description ?? '',
    qty: seed?.qty ?? '',
    unit: seed?.unit ?? '',
    specs: seed?.specs ?? '',
  };
}

function lineFromDoc(it: CrmRfqLineItem): DraftLine {
  return newLine({
    itemId: it.itemId ?? '',
    description: it.description ?? '',
    qty: Number.isFinite(it.qty) ? String(it.qty) : '',
    unit: it.unit ?? '',
    specs: it.specs ?? '',
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
      {editing ? 'Save changes' : 'Create RFQ'}
    </Button>
  );
}

const INITIAL_STATE = { message: undefined, error: undefined, id: undefined };

export function RfqForm({ initial }: RfqFormProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(saveRfqAction, INITIAL_STATE);

  const editing = !!initial?._id;

  // Lineage propagation from query string (e.g. ?fromKind=lead&fromId=...)
  // — used only on the Create flow.
  const fromKind = !editing ? (searchParams?.get('fromKind') ?? '') : '';
  const fromId = !editing ? (searchParams?.get('fromId') ?? '') : '';

  const [status, setStatus] = useState<string>(
    typeof initial?.status === 'string' ? initial.status : 'draft',
  );
  const [vendorIds, setVendorIds] = useState<string[]>(
    Array.isArray(initial?.vendorsInvited) ? initial!.vendorsInvited : [],
  );
  const [lines, setLines] = useState<DraftLine[]>(() =>
    initial?.items && initial.items.length > 0
      ? initial.items.map(lineFromDoc)
      : [newLine()],
  );
  const [attachments, setAttachments] = useState<CrmRfqAttachment[]>(
    Array.isArray(initial?.attachments) ? initial!.attachments : [],
  );

  // Serialise lines for the hidden `items` field so the server action
  // can rebuild the wire shape. Rows missing an `itemId` are kept here
  // (so the user can see them in the table), but the action layer
  // filters them out before sending to Rust.
  const itemsPayload = lines.map((l) => ({
    itemId: l.itemId || undefined,
    description: l.description || undefined,
    qty: toNum(l.qty),
    unit: l.unit || undefined,
    specs: l.specs || undefined,
  }));

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      localStorage.removeItem('rfq-draft');
      router.push(
        state.id
          ? `/dashboard/crm/purchases/rfqs/${state.id}`
          : '/dashboard/crm/purchases/rfqs',
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

  // Auto-save drafts to localStorage
  useEffect(() => {
    if (!editing && status === 'draft') {
      const draft = {
        status,
        vendorIds,
        lines,
        attachments,
      };
      localStorage.setItem('rfq-draft', JSON.stringify(draft));
    }
  }, [status, vendorIds, lines, attachments, editing]);

  // Load from localStorage on mount
  useEffect(() => {
    if (!editing) {
      const draftStr = localStorage.getItem('rfq-draft');
      if (draftStr) {
        try {
          const draft = JSON.parse(draftStr);
          if (draft.status) setStatus(draft.status);
          if (draft.vendorIds) setVendorIds(draft.vendorIds);
          if (draft.lines) setLines(draft.lines);
          if (draft.attachments) setAttachments(draft.attachments);
        } catch {}
      }
    }
  }, [editing]);

  const addLine = () => setLines((prev) => [...prev, newLine()]);
  const removeLine = (key: string) =>
    setLines((prev) =>
      prev.length > 1 ? prev.filter((l) => l.key !== key) : prev,
    );
  const updateLine = (key: string, patch: Partial<DraftLine>) =>
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    );

  const defaultRequiredBy = initial?.requiredBy
    ? new Date(initial.requiredBy).toISOString().slice(0, 10)
    : '';
  const defaultDeadline = initial?.deadline
    ? new Date(initial.deadline).toISOString().slice(0, 10)
    : '';

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      {editing ? (
        <input type="hidden" name="_id" value={String(initial!._id)} />
      ) : null}
      <input type="hidden" name="items" value={JSON.stringify(itemsPayload)} />
      <input
        type="hidden"
        name="vendorsInvited"
        value={JSON.stringify(vendorIds)}
      />
      <input
        type="hidden"
        name="attachments"
        value={JSON.stringify(attachments)}
      />
      <input type="hidden" name="status" value={status} />
      {fromKind ? <input type="hidden" name="fromKind" value={fromKind} /> : null}
      {fromId ? <input type="hidden" name="fromId" value={fromId} /> : null}

      {/* ─── Header ─────────────────────────────────────────────── */}
      <Card className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Header
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="title">
              Title <span className="text-zoru-danger-ink">*</span>
            </Label>
            <Input
              id="title"
              name="title"
              required
              defaultValue={initial?.title ?? ''}
              placeholder="e.g. Q3 Office Supplies — Stationery"
              maxLength={200}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="requiredBy">Required by</Label>
            <Input
              id="requiredBy"
              name="requiredBy"
              type="date"
              defaultValue={defaultRequiredBy}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="deadline">Submission deadline</Label>
            <Input
              id="deadline"
              name="deadline"
              type="date"
              defaultValue={defaultDeadline}
              className="mt-1.5"
            />
          </div>
        </div>
      </Card>

      {/* ─── Vendors invited ────────────────────────────────────── */}
      <Card className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Vendors invited
        </h3>
        <Label>Pick one or more vendors</Label>
        <div className="mt-1.5">
          <EntityPicker
            entity="vendor"
            multi
            value={vendorIds}
            placeholder="Select vendors to invite…"
            onChange={(next) => {
              if (Array.isArray(next)) setVendorIds(next);
              else if (typeof next === 'string') setVendorIds([next]);
              else setVendorIds([]);
            }}
          />
        </div>
        <p className="mt-2 text-[11px] text-zoru-ink-muted">
          Vendors are notified when the RFQ moves to <em>open</em>. The list
          can still be appended while the RFQ is open.
        </p>
      </Card>

      {/* ─── Line Items ─────────────────────────────────────────── */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
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
        <p className="mb-3 text-[11px] text-zoru-ink-muted">
          RFQ lines carry no price — vendors quote their rates back via a
          separate bid response.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-zoru-line text-left text-zoru-ink-muted">
                <th className="py-2 pr-3 font-medium">Item</th>
                <th className="py-2 pr-3 font-medium">Description</th>
                <th className="py-2 pr-3 font-medium">Qty</th>
                <th className="py-2 pr-3 font-medium">Unit</th>
                <th className="py-2 pr-3 font-medium">Specs / notes</th>
                <th className="py-2 pl-1" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr
                  key={line.key}
                  className="border-b border-zoru-line/60 align-top"
                >
                  <td className="min-w-[180px] py-2 pr-2">
                    <EntityPicker
                      entity="item"
                      value={line.itemId || null}
                      placeholder="Select item…"
                      onChange={(next, hydrated) => {
                        const id = Array.isArray(next)
                          ? (next[0] ?? '')
                          : (next ?? '');
                        const h = Array.isArray(hydrated)
                          ? hydrated[0]
                          : (hydrated as LookupItem | undefined);
                        // Seed the description from the item's primary
                        // label on first pick — only when the user
                        // hasn't typed one yet.
                        const seedDescription =
                          !line.description && h?.chip.primary
                            ? h.chip.primary
                            : line.description;
                        updateLine(line.key, {
                          itemId: id,
                          description: seedDescription,
                        });
                      }}
                    />
                  </td>
                  <td className="min-w-[180px] py-2 pr-2">
                    <Input
                      value={line.description}
                      onChange={(e) =>
                        updateLine(line.key, { description: e.target.value })
                      }
                      placeholder="Description"
                      maxLength={500}
                      className="h-8 text-[12.5px]"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <Input
                      value={line.qty}
                      onChange={(e) =>
                        updateLine(line.key, { qty: e.target.value })
                      }
                      type="number"
                      step="any"
                      min={0}
                      className="h-8 w-24 text-[12.5px]"
                    />
                  </td>
                  <td className="py-2 pr-2 min-w-[110px]">
                    <EntityPicker
                      entity="unit"
                      value={line.unit || null}
                      placeholder="ea, kg…"
                      onChange={(next) => {
                        const id = Array.isArray(next) ? (next[0] ?? '') : (next ?? '');
                        updateLine(line.key, { unit: id });
                      }}
                    />
                  </td>
                  <td className="min-w-[200px] py-2 pr-2">
                    <Input
                      value={line.specs}
                      onChange={(e) =>
                        updateLine(line.key, { specs: e.target.value })
                      }
                      placeholder="FSC certified, AGMARK grade…"
                      maxLength={500}
                      className="h-8 text-[12.5px]"
                    />
                  </td>
                  <td className="py-2 pl-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={lines.length === 1}
                      onClick={() => removeLine(line.key)}
                      className="text-zoru-danger-ink"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ─── Workflow + terms + attachments ─────────────────────── */}
      <Card className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Workflow
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Status</Label>
            <div className="mt-1.5">
              <EnumFormField
                enumName="rfqStatusV2"
                name="__status_picker"
                initialId={status || null}
                placeholder="Select status"
                onChange={(id) => setStatus(id ?? '')}
              />
            </div>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="terms">Terms</Label>
            <Textarea
              id="terms"
              name="terms"
              defaultValue={initial?.terms ?? ''}
              rows={4}
              maxLength={2000}
              placeholder="Payment, delivery, validity, penalties…"
              className="mt-1.5"
            />
          </div>
          <div className="md:col-span-2">
            <Label>Attachments</Label>
            <div className="mt-1.5">
              <SabFilePickerButton
                accept="all"
                title="Attach a file"
                onPick={({ id, url, name, mime, size }) => {
                  setAttachments((prev) => [
                    ...prev,
                    { fileId: id, url, name, mime, size },
                  ]);
                }}
              >
                <Upload className="h-4 w-4" />
                Add attachment
              </SabFilePickerButton>
            </div>
            {attachments.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-1.5">
                {attachments.map((a, idx) => (
                  <li
                    key={`${a.fileId ?? 'att'}-${idx}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-zoru-line px-2 py-1.5"
                  >
                    <span className="truncate text-[12px] text-zoru-ink">
                      {a.name || a.fileId || 'Attachment'}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove ${a.name ?? 'attachment'}`}
                      onClick={() =>
                        setAttachments((prev) =>
                          prev.filter((_, i) => i !== idx),
                        )
                      }
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="mt-2 text-[11px] text-zoru-ink-muted">
              Files are stored in your SabFiles library.
            </p>
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link
            href={
              editing
                ? `/dashboard/crm/purchases/rfqs/${String(initial!._id)}`
                : '/dashboard/crm/purchases/rfqs'
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
