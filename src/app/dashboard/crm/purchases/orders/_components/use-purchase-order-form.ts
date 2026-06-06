'use client';

import { useToast } from '@/components/sabcrm/20ui/compat';
import {
  useRouter } from 'next/navigation';
import { useActionState,
  useEffect,
  useMemo,
  useRef,
  useState } from 'react';

/**
 * usePurchaseOrderForm — state + side-effect orchestration for
 * `<PurchaseOrderForm>`.
 *
 * Mirrors `useInvoiceForm`: owns every field's local state, the dirty
 * flag, auto-save timer, the pending-intent + toast wiring, and the
 * line-item mutators. Returning a narrow surface keeps the form JSX
 * file simple.
 */

import * as React from 'react';

import { savePurchaseOrderAction } from '@/app/actions/crm/purchase-orders.actions';
import type {
  CrmPurchaseOrderDoc,
  CrmPurchaseOrderLineItem,
} from '@/lib/rust-client/crm-purchase-orders';

import type { POLineItemRow } from './purchase-order-line-items';

const INITIAL_STATE = { message: undefined, error: undefined, id: undefined };
const AUTO_SAVE_KEY = 'crm.purchaseOrders.draft';

export type SubmitIntent = 'save' | 'save-approval' | 'save-new';

interface UsePurchaseOrderFormArgs {
  initial?: CrmPurchaseOrderDoc | null;
  redirectTo?: string;
}

function newRow(): POLineItemRow {
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

function fromDoc(items?: CrmPurchaseOrderLineItem[]): POLineItemRow[] {
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

export function usePurchaseOrderForm({
  initial,
  redirectTo,
}: UsePurchaseOrderFormArgs) {
  const router = useRouter();
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(
    savePurchaseOrderAction,
    INITIAL_STATE,
  );

  const editing = !!initial?._id;

  const [currency, setCurrency] = useState<string>(initial?.currency ?? 'INR');
  const [rows, setRows] = useState<POLineItemRow[]>(() => fromDoc(initial?.items));

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

  /* Vendor / buyer */
  const [referenceNo, setReferenceNo] = useState<string>('');
  const [buyerId, setBuyerId] = useState<string | null>(
    initial?.assignment?.assignedTo
      ? String(initial.assignment.assignedTo)
      : null,
  );

  /* Approval */
  const [approverId, setApproverId] = useState<string | null>(
    initial?.approval?.approvedBy
      ? String(initial.approval.approvedBy)
      : null,
  );
  const [approvalNote, setApprovalNote] = useState<string>(
    initial?.approval?.note ?? '',
  );

  /* Submit intent + status */
  const [submitIntent, setSubmitIntent] = useState<SubmitIntent>('save');
  const [pendingIntent, setPendingIntent] = useState<string | null>(null);
  const [statusValue, setStatusValue] = useState<string>(
    (typeof initial?.status === 'string' ? initial.status : 'draft') || 'draft',
  );

  /* Dirty flag */
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

  /* Auto-save draft to localStorage every 30s (create mode only) */
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
        router.push('/dashboard/crm/purchases/orders/new');
        return;
      }
      const next =
        redirectTo ??
        (state.id
          ? `/dashboard/crm/purchases/orders/${state.id}`
          : '/dashboard/crm/purchases/orders');
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
    (key: string, patch: Partial<POLineItemRow>) => {
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

  const lineItemsForSubmit: CrmPurchaseOrderLineItem[] = rows
    .filter(
      (r) =>
        Number(r.qty) > 0 ||
        Number(r.rate) > 0 ||
        (r.description && r.description.length > 0) ||
        Boolean(r.itemId),
    )
    .map(({ _key: _ignored, ...rest }) => rest);

  const handleFormSubmit = React.useCallback(() => {
    setPendingIntent(submitIntent);
    if (submitIntent === 'save-approval') setStatusValue('awaiting_approval');
  }, [submitIntent]);

  return {
    /* refs / actions */
    formRef,
    formAction,
    editing,
    /* state */
    currency,
    setCurrency: (v: string) => {
      setCurrency(v);
      markDirty();
    },
    rows,
    addRow,
    removeRow,
    patchRow,
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
    referenceNo,
    setReferenceNo: (v: string) => {
      setReferenceNo(v);
      markDirty();
    },
    buyerId,
    setBuyerId: (v: string | null) => {
      setBuyerId(v);
      markDirty();
    },
    approverId,
    setApproverId: (v: string | null) => {
      setApproverId(v);
      markDirty();
    },
    approvalNote,
    setApprovalNote: (v: string) => {
      setApprovalNote(v);
      markDirty();
    },
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
    dirty,
  };
}

export { toDateInput };
