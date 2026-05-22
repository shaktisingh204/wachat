'use client';

import { useZoruToast } from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';
import { useActionState,
  useEffect,
  useMemo,
  useRef,
  useState } from 'react';

/**
 * useInvoiceForm — state + side-effect orchestration for `<InvoiceForm>`.
 *
 * Owns every field's local state, the dirty flag, auto-save timer, the
 * pending-intent + toast wiring, line-item mutators, and the
 * customFields blob that ends up serialized on submit. Returning a
 * narrow surface keeps the form JSX file simple.
 */

import * as React from 'react';

import { saveInvoiceAction } from '@/app/actions/crm/invoices.actions';
import type {
  CrmInvoiceDoc,
  CrmInvoiceGstTreatment,
  CrmInvoiceLineItem,
  CrmInvoiceRecurringFrequency,
} from '@/lib/rust-client/crm-invoices';
import type { WsCustomField } from '@/lib/worksuite/meta-types';
import type { CustomFieldValue } from '@/components/crm/custom-field-input';

import type { LineItemRow } from './invoice-line-items';

const INITIAL_STATE = { message: undefined, error: undefined, id: undefined };
const AUTO_SAVE_KEY = 'crm.invoices.draft';

export type SubmitIntent = 'save' | 'save-send' | 'save-new';

interface UseInvoiceFormArgs {
  initial?: CrmInvoiceDoc | null;
  customFields: WsCustomField[];
  redirectTo?: string;
}

function newRow(): LineItemRow {
  return {
    _key: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    itemId: undefined,
    description: '',
    qty: 1,
    rate: 0,
    discountPct: undefined,
    taxRatePct: undefined,
    total: 0,
  };
}

function fromDoc(items?: CrmInvoiceLineItem[]): LineItemRow[] {
  if (!items || items.length === 0) return [newRow()];
  return items.map((li, idx) => ({
    _key: `row-${idx}-${Math.random().toString(36).slice(2, 7)}`,
    ...li,
  }));
}

function toDateInput(value?: string): string {
  if (!value) return '';
  const d = new Date(value);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

export function useInvoiceForm({
  initial,
  customFields,
  redirectTo,
}: UseInvoiceFormArgs) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(saveInvoiceAction, INITIAL_STATE);

  const editing = !!initial?._id;

  const [currency, setCurrency] = useState<string>(initial?.currency ?? 'INR');
  const [rows, setRows] = useState<LineItemRow[]>(() => fromDoc(initial?.items));
  const [reverseCharge, setReverseCharge] = useState<boolean>(
    Boolean(initial?.reverseCharge),
  );
  const [gstTreatment, setGstTreatment] = useState<
    CrmInvoiceGstTreatment | ''
  >(initial?.gstTreatment ?? '');

  const [discountOverall, setDiscountOverall] = useState<string>(
    initial?.totals?.discountOverall != null
      ? String(initial.totals.discountOverall)
      : '',
  );
  const [shippingCharge, setShippingCharge] = useState<string>(
    initial?.totals?.shippingCharge != null
      ? String(initial.totals.shippingCharge)
      : '',
  );
  const [adjustment, setAdjustment] = useState<string>(
    initial?.totals?.adjustment != null
      ? String(initial.totals.adjustment)
      : '',
  );
  const [roundOff, setRoundOff] = useState<string>(
    initial?.totals?.roundOff != null ? String(initial.totals.roundOff) : '',
  );

  const [billingAddress, setBillingAddress] = useState<string>(
    typeof initial?.billingAddress === 'string' ? initial.billingAddress : '',
  );
  const [shippingAddress, setShippingAddress] = useState<string>(
    typeof initial?.shippingAddress === 'string' ? initial.shippingAddress : '',
  );

  const [bankAccountId, setBankAccountId] = useState<string | null>(null);
  const [upiId, setUpiId] = useState<string>(initial?.upiId ?? '');
  const [qrImageFileId, setQrImageFileId] = useState<string>(
    initial?.qrImageFileId ?? '',
  );

  const [eInvoiceIrn, setEInvoiceIrn] = useState<string>(
    initial?.eInvoice?.irn ?? '',
  );
  const [eInvoiceQr, setEInvoiceQr] = useState<string>(
    initial?.eInvoice?.qrString ?? '',
  );
  const [eInvoiceAckNo, setEInvoiceAckNo] = useState<string>(
    initial?.eInvoice?.ackNo ?? '',
  );
  const [eInvoiceAckDate, setEInvoiceAckDate] = useState<string>(
    toDateInput(initial?.eInvoice?.ackDate),
  );
  const [ewayBillNo, setEwayBillNo] = useState<string>(
    initial?.ewayBillNo ?? '',
  );

  const [recurringEnabled, setRecurringEnabled] = useState<boolean>(
    Boolean(initial?.recurring),
  );
  const [recurringFrequency, setRecurringFrequency] = useState<
    CrmInvoiceRecurringFrequency | ''
  >(initial?.recurring?.frequency ?? '');
  const [recurringEnd, setRecurringEnd] = useState<string>(
    toDateInput(initial?.recurring?.endDate),
  );
  const [recurringNextRun, setRecurringNextRun] = useState<string>(
    toDateInput(initial?.recurring?.nextRun),
  );

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

  const [submitIntent, setSubmitIntent] = useState<SubmitIntent>('save');
  const [pendingIntent, setPendingIntent] = useState<string | null>(null);
  const [statusValue, setStatusValue] = useState<string>(
    (initial?.status as string) || 'draft',
  );

  const [dirty, setDirty] = useState(false);
  const markDirty = React.useCallback(() => setDirty(true), []);

  useEffect(() => {
    const handler = () => setDirty(true);
    const el = formRef.current;
    if (!el) return;
    el.addEventListener('input', handler);
    el.addEventListener('change', handler);
    return () => {
      el.removeEventListener('input', handler);
      el.removeEventListener('change', handler);
    };
  }, []);

  useEffect(() => {
    if (editing) return;
    const tick = setInterval(() => {
      try {
        const snapshot = formRef.current ? new FormData(formRef.current) : null;
        if (!snapshot) return;
        const entries: Record<string, string> = {};
        snapshot.forEach((v, k) => {
          if (typeof v === 'string' && v.length < 5000) entries[k] = v;
        });
        window.localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(entries));
      } catch {
        /* ignore */
      }
    }, 30_000);
    return () => clearInterval(tick);
  }, [editing]);

  useEffect(() => {
    if (state?.message) {
      setDirty(false);
      setPendingIntent(null);
      toast({ title: 'Saved', description: state.message });
      try {
        window.localStorage.removeItem(AUTO_SAVE_KEY);
      } catch {
        /* ignore */
      }
      if (submitIntent === 'save-new') {
        router.push('/dashboard/crm/sales/invoices/new');
        return;
      }
      const next =
        redirectTo ??
        (state.id
          ? `/dashboard/crm/sales/invoices/${state.id}`
          : '/dashboard/crm/sales/invoices');
      router.push(next);
    }
    if (state?.error) {
      setPendingIntent(null);
      toast({
        title: 'Error',
        description: state.error,
        variant: 'destructive',
      });
    }
  }, [state, toast, router, redirectTo, submitIntent]);

  const handleCustomFieldChange = React.useCallback(
    (name: string, next: CustomFieldValue) => {
      setCustomFieldValues((prev) => ({ ...prev, [name]: next }));
      setDirty(true);
    },
    [],
  );

  const addRow = React.useCallback(() => {
    setRows((prev) => [...prev, newRow()]);
    setDirty(true);
  }, []);
  const removeRow = React.useCallback((key: string) => {
    setRows((prev) =>
      prev.length <= 1 ? prev : prev.filter((r) => r._key !== key),
    );
    setDirty(true);
  }, []);
  const patchRow = React.useCallback(
    (key: string, patch: Partial<LineItemRow>) => {
      setRows((prev) =>
        prev.map((r) => {
          if (r._key !== key) return r;
          const next = { ...r, ...patch };
          const qty = Number(next.qty) || 0;
          const rate = Number(next.rate) || 0;
          const dPct = Number(next.discountPct) || 0;
          const tPct = Number(next.taxRatePct) || 0;
          const baseLine = qty * rate;
          const discounted = baseLine * (1 - dPct / 100);
          const taxed = discounted * (1 + tPct / 100);
          next.total = Number.isFinite(taxed) ? taxed : 0;
          return next;
        }),
      );
      setDirty(true);
    },
    [],
  );

  const subTotal = rows.reduce((s, r) => s + (Number(r.total) || 0), 0);
  const total = useMemo(() => {
    const d = Number(discountOverall) || 0;
    const sh = Number(shippingCharge) || 0;
    const a = Number(adjustment) || 0;
    const ro = Number(roundOff) || 0;
    return subTotal - d + sh + a + ro;
  }, [subTotal, discountOverall, shippingCharge, adjustment, roundOff]);

  const lineItemsForSubmit: CrmInvoiceLineItem[] = rows
    .filter(
      (r) =>
        Number(r.qty) > 0 ||
        Number(r.rate) > 0 ||
        (r.description && r.description.length > 0),
    )
    .map(({ _key: _ignored, ...rest }) => rest);

  const customFieldsForSubmit = useMemo(() => {
    return {
      ...customFieldValues,
      _billingAddress: billingAddress || undefined,
      _shippingAddress: shippingAddress || undefined,
      _reverseCharge: reverseCharge || undefined,
      _gstTreatment: gstTreatment || undefined,
      _bankAccountId: bankAccountId || undefined,
      _upiId: upiId || undefined,
      _qrImageFileId: qrImageFileId || undefined,
      _eInvoiceIrn: eInvoiceIrn || undefined,
      _eInvoiceQr: eInvoiceQr || undefined,
      _eInvoiceAckNo: eInvoiceAckNo || undefined,
      _eInvoiceAckDate: eInvoiceAckDate || undefined,
      _ewayBillNo: ewayBillNo || undefined,
      _recurring: recurringEnabled
        ? {
            frequency: recurringFrequency || undefined,
            endDate: recurringEnd || undefined,
            nextRun: recurringNextRun || undefined,
          }
        : undefined,
    };
  }, [
    customFieldValues,
    billingAddress,
    shippingAddress,
    reverseCharge,
    gstTreatment,
    bankAccountId,
    upiId,
    qrImageFileId,
    eInvoiceIrn,
    eInvoiceQr,
    eInvoiceAckNo,
    eInvoiceAckDate,
    ewayBillNo,
    recurringEnabled,
    recurringFrequency,
    recurringEnd,
    recurringNextRun,
  ]);

  const handleFormSubmit = React.useCallback(() => {
    setPendingIntent(submitIntent);
    if (submitIntent === 'save-send') setStatusValue('sent');
  }, [submitIntent]);

  return {
    /* refs / actions */
    formRef,
    formAction,
    editing,
    /* state + setters (each setter wraps markDirty internally) */
    currency,
    setCurrency: (v: string) => {
      setCurrency(v);
      markDirty();
    },
    rows,
    setRows: (r: LineItemRow[]) => {
      setRows(r);
      setDirty(true);
    },
    addRow,
    removeRow,
    patchRow,
    reverseCharge,
    setReverseCharge: (v: boolean) => {
      setReverseCharge(v);
      markDirty();
    },
    gstTreatment,
    setGstTreatment: (v: CrmInvoiceGstTreatment | '') => {
      setGstTreatment(v);
      markDirty();
    },
    discountOverall,
    setDiscountOverall: (v: string) => {
      setDiscountOverall(v);
      markDirty();
    },
    shippingCharge,
    setShippingCharge: (v: string) => {
      setShippingCharge(v);
      markDirty();
    },
    adjustment,
    setAdjustment: (v: string) => {
      setAdjustment(v);
      markDirty();
    },
    roundOff,
    setRoundOff: (v: string) => {
      setRoundOff(v);
      markDirty();
    },
    billingAddress,
    setBillingAddress: (v: string) => {
      setBillingAddress(v);
      markDirty();
    },
    shippingAddress,
    setShippingAddress: (v: string) => {
      setShippingAddress(v);
      markDirty();
    },
    bankAccountId,
    setBankAccountId: (v: string | null) => {
      setBankAccountId(v);
      markDirty();
    },
    upiId,
    setUpiId: (v: string) => {
      setUpiId(v);
      markDirty();
    },
    qrImageFileId,
    setQrImageFileId: (v: string) => {
      setQrImageFileId(v);
      markDirty();
    },
    eInvoiceIrn,
    setEInvoiceIrn: (v: string) => {
      setEInvoiceIrn(v);
      markDirty();
    },
    eInvoiceQr,
    setEInvoiceQr: (v: string) => {
      setEInvoiceQr(v);
      markDirty();
    },
    eInvoiceAckNo,
    setEInvoiceAckNo: (v: string) => {
      setEInvoiceAckNo(v);
      markDirty();
    },
    eInvoiceAckDate,
    setEInvoiceAckDate: (v: string) => {
      setEInvoiceAckDate(v);
      markDirty();
    },
    ewayBillNo,
    setEwayBillNo: (v: string) => {
      setEwayBillNo(v);
      markDirty();
    },
    recurringEnabled,
    setRecurringEnabled: (v: boolean) => {
      setRecurringEnabled(v);
      markDirty();
    },
    recurringFrequency,
    setRecurringFrequency: (v: CrmInvoiceRecurringFrequency | '') => {
      setRecurringFrequency(v);
      markDirty();
    },
    recurringEnd,
    setRecurringEnd: (v: string) => {
      setRecurringEnd(v);
      markDirty();
    },
    recurringNextRun,
    setRecurringNextRun: (v: string) => {
      setRecurringNextRun(v);
      markDirty();
    },
    customFieldValues,
    handleCustomFieldChange,
    /* submit */
    statusValue,
    setStatusValue: (v: string) => {
      setStatusValue(v);
      markDirty();
    },
    submitIntent,
    setSubmitIntent,
    pendingIntent,
    handleFormSubmit,
    /* derived */
    subTotal,
    total,
    lineItemsForSubmit,
    customFieldsForSubmit,
    dirty,
  };
}

export { toDateInput };
