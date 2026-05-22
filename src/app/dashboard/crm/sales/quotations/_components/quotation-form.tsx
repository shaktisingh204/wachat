'use client';

import { Button, Card, useZoruToast } from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter,
  useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { LoaderCircle } from 'lucide-react';

/**
 * <QuotationForm> — single source of truth for both Create and Edit
 * flows for the canonical Quotations module per
 * `docs/ecosystem/CRM_REBUILD_PLAN.md` §1D.3.
 *
 * Sections (top→bottom):
 *   1. Header — quotation number, date, valid-until.
 *   2. Customer — client / reference / sales agent / pipeline+deal.
 *   3. Subject + place of supply.
 *   4. Line items — managed by <QuotationLineItemsEditor>.
 *   5. Summary — subtotal · discount · shipping · adjustment · roundOff
 *      · total.
 *   6. Terms & conditions / Customer notes (textareas).
 *   7. Attachments (SabFile picker) + signature (SabFile).
 *   8. Template (entity picker).
 *
 * Smart defaults: `?fromKind=deal&fromId=` and `?fromKind=lead&fromId=`
 * pre-fill the customer + line items the parent doc references. The
 * `_id` hidden input toggles between POST (create) and PATCH (edit) on
 * the server-action side.
 *
 * **FormData key contract** — every named input below matches what
 * `saveQuotationAction` reads via `formData.get(...)`:
 *
 *   _id, quotationNo, date, validUntil, clientId, currency, status,
 *   subject, placeOfSupply, termsAndConditions, notes, items,
 *   customFields, fromKind, fromId, referenceNo, salesAgentId, dealId,
 *   pipelineId, attachmentUrls, signatureImage, templateId.
 */

import * as React from 'react';

import { DirtyFormPrompt } from '@/components/crm/dirty-form-prompt';
import {
  CustomFieldInput,
  type CustomFieldValue,
} from '@/components/crm/custom-field-input';
import { saveQuotationAction } from '@/app/actions/crm/quotations.actions';
import type {
  CrmQuotationDoc,
  CrmQuotationLineItem,
} from '@/lib/rust-client/crm-quotations';
import type { WsCustomField } from '@/lib/worksuite/meta-types';

import {
  QuotationAttachmentsSection,
  QuotationSummarySection,
  QuotationTemplateSection,
} from './quotation-form-extras';
import {
  QuotationCustomerSection,
  QuotationHeaderSection,
  QuotationNotesSection,
  QuotationSubjectSection,
} from './quotation-form-sections';
import {
  QuotationLineItemsEditor,
  freshRow,
  seedRows,
  type LineRow,
} from './quotation-line-items-editor';

interface QuotationFormProps {
  /** Existing quotation — present in Edit mode, omit for Create. */
  initial?: CrmQuotationDoc | null;
  /** Custom field definitions for `belongs_to = 'quotation'`. */
  customFields: WsCustomField[];
}

const DRAFT_KEY = 'crm.quotations.draft';

const INITIAL_ACTION_STATE: { message?: string; error?: string; id?: string } = {
  message: undefined,
  error: undefined,
  id: undefined,
};

function SubmitButton({
  editing,
  intent,
  onIntent,
}: {
  editing: boolean;
  intent: SaveIntent;
  onIntent: (i: SaveIntent) => void;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      onClick={() => onIntent('save')}
      disabled={pending}
      data-intent={intent}
    >
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {editing ? 'Save changes' : 'Create quotation'}
    </Button>
  );
}

type SaveIntent = 'save' | 'save_new' | 'save_send' | 'save_convert';

export function QuotationForm({ initial, customFields }: QuotationFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(saveQuotationAction, INITIAL_ACTION_STATE);

  const editing = !!initial?._id;

  /* Smart defaults from query string. */
  const fromKind = (searchParams?.get('fromKind') ?? '') as '' | 'deal' | 'lead';
  const fromId = searchParams?.get('fromId') ?? '';

  /* ----- intent (which submit button got clicked) -------------- */
  const [intent, setIntent] = useState<SaveIntent>('save');

  /* ----- line items -------------------------------------------- */
  const [rows, setRows] = useState<LineRow[]>(() => seedRows(initial?.items));
  const addRow = () => setRows((prev) => [...prev, freshRow()]);
  const removeRow = (key: string) =>
    setRows((prev) => (prev.length === 1 ? [freshRow()] : prev.filter((r) => r.rowKey !== key)));
  const patchRow = (key: string, patch: Partial<LineRow>) =>
    setRows((prev) => prev.map((r) => (r.rowKey === key ? { ...r, ...patch } : r)));

  const itemsPayload = useMemo<CrmQuotationLineItem[]>(
    () =>
      rows.map((r) => {
        const qty = Number(r.qty) || 0;
        const rate = Number(r.rate) || 0;
        const sub = qty * rate;
        const taxRate = Number(r.taxRatePct);
        const total =
          sub + (Number.isFinite(taxRate) && taxRate > 0 ? (sub * taxRate) / 100 : 0);
        return {
          itemId: r.itemId,
          description: r.description,
          hsnSac: r.hsnSac,
          qty,
          unit: r.unit,
          rate,
          discountPct: r.discountPct,
          taxRatePct: Number.isFinite(taxRate) ? taxRate : undefined,
          cgstAmount: r.cgstAmount,
          sgstAmount: r.sgstAmount,
          igstAmount: r.igstAmount,
          cessAmount: r.cessAmount,
          total,
        };
      }),
    [rows],
  );

  /* ----- summary numbers --------------------------------------- */
  const [discountOverall, setDiscountOverall] = useState<number>(
    initial?.totals?.discountOverall ?? 0,
  );
  const [shippingCharge, setShippingCharge] = useState<number>(
    initial?.totals?.shippingCharge ?? 0,
  );
  const [adjustment, setAdjustment] = useState<number>(initial?.totals?.adjustment ?? 0);
  const [roundOff, setRoundOff] = useState<number>(initial?.totals?.roundOff ?? 0);

  const totals = useMemo(() => {
    let subTotal = 0;
    let taxTotal = 0;
    for (const r of rows) {
      const qty = Number(r.qty) || 0;
      const rate = Number(r.rate) || 0;
      const sub = qty * rate;
      subTotal += sub;
      const taxRate = Number(r.taxRatePct);
      if (Number.isFinite(taxRate) && taxRate > 0) taxTotal += (sub * taxRate) / 100;
    }
    const total =
      subTotal + taxTotal - (discountOverall || 0) + (shippingCharge || 0) + (adjustment || 0) + (roundOff || 0);
    return { subTotal, taxTotal, total };
  }, [rows, discountOverall, shippingCharge, adjustment, roundOff]);

  /* ----- custom fields ----------------------------------------- */
  const [customFieldValues, setCustomFieldValues] = useState<
    Record<string, CustomFieldValue>
  >(() => {
    const seed: Record<string, CustomFieldValue> = {};
    const bag = (initial?.customFields ?? {}) as Record<string, unknown>;
    for (const f of customFields) {
      const v = bag[f.name];
      if (v !== undefined) seed[f.name] = v as CustomFieldValue;
    }
    return seed;
  });
  const handleCustomFieldChange = (name: string, next: CustomFieldValue) =>
    setCustomFieldValues((prev) => ({ ...prev, [name]: next }));

  /* ----- currency tracker (drives money labels) ---------------- */
  const [currency, setCurrency] = useState<string>(initial?.currency ?? 'INR');
  const fmtMoney = (n: number) => {
    try {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: currency || 'INR',
        maximumFractionDigits: 2,
      }).format(n);
    } catch {
      return `${currency || 'INR'} ${n.toFixed(2)}`;
    }
  };

  /* ----- pipeline cascade -------------------------------------- */
  const [pipelineId, setPipelineId] = useState<string | null>(null);

  /* ----- attachments + signature ------------------------------- */
  const [attachments, setAttachments] = useState<string[]>([]);
  const [signatureImage, setSignatureImage] = useState<string>('');

  /* ----- dirty tracking + auto-save draft (only on /new) ------- */
  const [dirty, setDirty] = useState(false);
  const markDirty = React.useCallback(() => setDirty(true), []);

  useEffect(() => {
    if (editing) return;
    if (!dirty) return;
    const tid = window.setTimeout(() => {
      try {
        const snap = {
          quotationNo: formRef.current?.elements.namedItem('quotationNo'),
          rows,
          attachments,
          signatureImage,
          currency,
          customFieldValues,
        };
        // Only serialize JSON-safe snapshot
        window.localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({
            rows,
            attachments,
            signatureImage,
            currency,
            customFieldValues,
          }),
        );
        void snap;
      } catch {
        // ignore
      }
    }, 1000);
    return () => window.clearTimeout(tid);
  }, [editing, dirty, rows, attachments, signatureImage, currency, customFieldValues]);

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      setDirty(false);
      try {
        window.localStorage.removeItem(DRAFT_KEY);
      } catch {
        // ignore
      }
      if (intent === 'save_new') {
        router.push('/dashboard/crm/sales/quotations/new');
        return;
      }
      if (intent === 'save_convert' && state.id) {
        router.push(
          `/dashboard/crm/sales/invoices/new?fromKind=quotation&fromId=${state.id}`,
        );
        return;
      }
      router.push(
        state.id
          ? `/dashboard/crm/sales/quotations/${state.id}`
          : '/dashboard/crm/sales/quotations',
      );
    }
    if (state?.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  /* ─── Render ─────────────────────────────────────────────────── */

  return (
    <form
      ref={formRef}
      action={formAction}
      onChange={markDirty}
      className="flex w-full flex-col gap-6"
    >
      <DirtyFormPrompt dirty={dirty} />

      {editing ? <input type="hidden" name="_id" value={String(initial!._id)} /> : null}
      {!editing && fromKind && fromId ? (
        <>
          <input type="hidden" name="fromKind" value={fromKind} />
          <input type="hidden" name="fromId" value={fromId} />
        </>
      ) : null}

      <input type="hidden" name="items" value={JSON.stringify(itemsPayload)} />
      <input
        type="hidden"
        name="customFields"
        value={JSON.stringify(customFieldValues)}
      />
      <input type="hidden" name="attachmentUrls" value={JSON.stringify(attachments)} />
      <input type="hidden" name="signatureImage" value={signatureImage} />

      {/* ─── Section 1: Header ─────────────────────────────────── */}
      <QuotationHeaderSection initial={initial} />

      {/* ─── Section 2: Customer ───────────────────────────────── */}
      <QuotationCustomerSection
        initial={initial}
        pipelineId={pipelineId}
        onPipelineChange={setPipelineId}
        onAnyChange={markDirty}
      />

      {/* ─── Section 3: Subject + place of supply ─────────────── */}
      <QuotationSubjectSection
        initial={initial}
        editing={editing}
        onCurrencyChange={setCurrency}
        onAnyChange={markDirty}
      />

      {/* ─── Section 4: Line items ─────────────────────────────── */}
      <Card className="space-y-4 p-6">
        <QuotationLineItemsEditor
          rows={rows}
          onAdd={addRow}
          onPatch={patchRow}
          onRemove={removeRow}
          fmtMoney={fmtMoney}
        />
      </Card>

      {/* ─── Section 5: Summary ────────────────────────────────── */}
      <QuotationSummarySection
        totals={totals}
        discountOverall={discountOverall}
        shippingCharge={shippingCharge}
        adjustment={adjustment}
        roundOff={roundOff}
        fmtMoney={fmtMoney}
        onDiscountChange={(v) => {
          setDiscountOverall(v);
          markDirty();
        }}
        onShippingChange={(v) => {
          setShippingCharge(v);
          markDirty();
        }}
        onAdjustmentChange={(v) => {
          setAdjustment(v);
          markDirty();
        }}
        onRoundOffChange={(v) => {
          setRoundOff(v);
          markDirty();
        }}
      />

      {/* ─── Section 6: Notes / Terms ──────────────────────────── */}
      <QuotationNotesSection initial={initial} />

      {/* ─── Section 7: Attachments + Signature ────────────────── */}
      <QuotationAttachmentsSection
        attachments={attachments}
        signatureImage={signatureImage}
        onAddAttachment={(url) => {
          setAttachments((prev) => (prev.includes(url) ? prev : [...prev, url]));
          markDirty();
        }}
        onRemoveAttachment={(url) => {
          setAttachments((prev) => prev.filter((u) => u !== url));
          markDirty();
        }}
        onSetSignature={(url) => {
          setSignatureImage(url);
          markDirty();
        }}
      />

      {/* ─── Section 8: Template ───────────────────────────────── */}
      <QuotationTemplateSection onTemplateChange={markDirty} />

      {/* Custom fields */}
      {customFields.length > 0 ? (
        <Card className="space-y-4 p-6">
          <div>
            <h2 className="text-[15px] font-semibold text-zoru-ink">Custom fields</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {customFields.map((f) => (
              <CustomFieldInput
                key={String(f._id ?? f.name)}
                field={f}
                value={customFieldValues[f.name]}
                onChange={(v) => handleCustomFieldChange(f.name, v)}
              />
            ))}
          </div>
        </Card>
      ) : null}

      {/* Inline error */}
      {state?.error ? (
        <p role="alert" className="text-sm text-zoru-danger-ink">
          {state.error}
        </p>
      ) : null}

      {/* Sticky action bar */}
      <div className="sticky bottom-0 z-10 border-t border-zoru-line bg-zoru-bg py-3">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" asChild>
            <Link
              href={
                editing
                  ? `/dashboard/crm/sales/quotations/${String(initial!._id)}`
                  : '/dashboard/crm/sales/quotations'
              }
            >
              Cancel
            </Link>
          </Button>
          <Button
            type="submit"
            variant="outline"
            onClick={() => setIntent('save_new')}
            name="_action"
            value="save_new"
          >
            Save &amp; new
          </Button>
          <Button
            type="submit"
            variant="outline"
            onClick={() => setIntent('save_send')}
            name="_action"
            value="save_send"
          >
            Save &amp; send
          </Button>
          <Button
            type="submit"
            variant="outline"
            onClick={() => setIntent('save_convert')}
            name="_action"
            value="save_convert"
          >
            Save &amp; convert to invoice
          </Button>
          <SubmitButton editing={editing} intent={intent} onIntent={setIntent} />
        </div>
      </div>
    </form>
  );
}

