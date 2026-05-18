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
 * useBillForm — state + side-effect orchestration for `<BillForm>`.
 *
 * Owns every field's local state, the dirty flag, auto-save timer, the
 * pending-intent + toast wiring, line/expense-item mutators, and the
 * customFields blob that ends up serialized on submit. Returning a
 * narrow surface keeps the form JSX file simple.
 *
 * Mirrors `useInvoiceForm` per CRM_REBUILD_PLAN §1D.
 */

import * as React from 'react';

import { saveBillAction } from '@/app/actions/crm/bills.actions';
import type {
  CrmBillDoc,
  CrmBillExpenseLine,
  CrmBillLineItem,
  CrmBillRecurringFrequency,
} from '@/lib/rust-client/crm-bills';
import type { WsCustomField } from '@/lib/worksuite/meta-types';
import type { CustomFieldValue } from '@/components/crm/custom-field-input';

import type { LineItemRow } from './bill-line-items';
import type { ExpenseLineRow } from './bill-expense-lines';

const INITIAL_STATE = { message: undefined, error: undefined, id: undefined };
const AUTO_SAVE_KEY = 'crm.bills.draft';

export type SubmitIntent = 'save' | 'save-pay' | 'save-new';
export type EntryMode = 'items' | 'expenses';

interface UseBillFormArgs {
  initial?: CrmBillDoc | null;
  customFields: WsCustomField[];
  redirectTo?: string;
}

function newItemRow(): LineItemRow {
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

function newExpenseRow(): ExpenseLineRow {
  return {
    _key: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    accountId: undefined,
    description: '',
    amount: 0,
    taxRatePct: undefined,
  };
}

function itemsFromDoc(items?: CrmBillLineItem[]): LineItemRow[] {
  if (!items || items.length === 0) return [newItemRow()];
  return items.map((li, idx) => ({
    _key: `row-${idx}-${Math.random().toString(36).slice(2, 7)}`,
    ...li,
  }));
}

function expensesFromDoc(lines?: CrmBillExpenseLine[]): ExpenseLineRow[] {
  if (!lines || lines.length === 0) return [newExpenseRow()];
  return lines.map((li, idx) => ({
    _key: `row-${idx}-${Math.random().toString(36).slice(2, 7)}`,
    ...li,
  }));
}

function toDateInput(value?: string): string {
  if (!value) return '';
  const d = new Date(value);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

export function useBillForm({
  initial,
  customFields,
  redirectTo,
}: UseBillFormArgs) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(saveBillAction, INITIAL_STATE);

  const editing = !!initial?._id;

  const [currency, setCurrency] = useState<string>(initial?.currency ?? 'INR');
  const [entryMode, setEntryMode] = useState<EntryMode>(() =>
    initial?.expenseLines && initial.expenseLines.length > 0 && (!initial.items || initial.items.length === 0)
      ? 'expenses'
      : 'items',
  );

  const [itemRows, setItemRows] = useState<LineItemRow[]>(() =>
    itemsFromDoc(initial?.items),
  );
  const [expenseRows, setExpenseRows] = useState<ExpenseLineRow[]>(() =>
    expensesFromDoc(initial?.expenseLines),
  );

  const [reverseCharge, setReverseCharge] = useState<boolean>(
    Boolean(initial?.reverseCharge),
  );

  const [linkedPoId, setLinkedPoId] = useState<string | null>(
    initial?.linkedPoId ?? null,
  );
  const [linkedGrnIds, setLinkedGrnIds] = useState<string>(
    Array.isArray(initial?.linkedGrnIds) ? initial!.linkedGrnIds!.join(', ') : '',
  );

  const [recurringEnabled, setRecurringEnabled] = useState<boolean>(
    Boolean(initial?.recurring),
  );
  const [recurringFrequency, setRecurringFrequency] = useState<
    CrmBillRecurringFrequency | ''
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
        router.push('/dashboard/crm/purchases/expenses/new');
        return;
      }
      if (submitIntent === 'save-pay' && state.id) {
        router.push(
          `/dashboard/crm/purchases/payouts/new?fromKind=bill&fromId=${state.id}`,
        );
        return;
      }
      const next =
        redirectTo ??
        (state.id
          ? `/dashboard/crm/purchases/expenses/${state.id}`
          : '/dashboard/crm/purchases/expenses');
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

  /* Inventory line items */
  const addItemRow = React.useCallback(() => {
    setItemRows((prev) => [...prev, newItemRow()]);
    setDirty(true);
  }, []);
  const removeItemRow = React.useCallback((key: string) => {
    setItemRows((prev) =>
      prev.length <= 1 ? prev : prev.filter((r) => r._key !== key),
    );
    setDirty(true);
  }, []);
  const patchItemRow = React.useCallback(
    (key: string, patch: Partial<LineItemRow>) => {
      setItemRows((prev) =>
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

  /* Expense lines */
  const addExpenseRow = React.useCallback(() => {
    setExpenseRows((prev) => [...prev, newExpenseRow()]);
    setDirty(true);
  }, []);
  const removeExpenseRow = React.useCallback((key: string) => {
    setExpenseRows((prev) =>
      prev.length <= 1 ? prev : prev.filter((r) => r._key !== key),
    );
    setDirty(true);
  }, []);
  const patchExpenseRow = React.useCallback(
    (key: string, patch: Partial<ExpenseLineRow>) => {
      setExpenseRows((prev) =>
        prev.map((r) => (r._key !== key ? r : { ...r, ...patch })),
      );
      setDirty(true);
    },
    [],
  );

  const subTotal = useMemo(() => {
    if (entryMode === 'items') {
      return itemRows.reduce((s, r) => s + (Number(r.total) || 0), 0);
    }
    return expenseRows.reduce((s, r) => {
      const amt = Number(r.amount) || 0;
      const pct = Number(r.taxRatePct) || 0;
      return s + amt * (1 + pct / 100);
    }, 0);
  }, [entryMode, itemRows, expenseRows]);
  const total = subTotal;

  const lineItemsForSubmit: CrmBillLineItem[] =
    entryMode === 'items'
      ? itemRows
          .filter(
            (r) =>
              Number(r.qty) > 0 ||
              Number(r.rate) > 0 ||
              (r.description && r.description.length > 0),
          )
          .map(({ _key: _ignored, ...rest }) => rest)
      : [];

  const expenseLinesForSubmit: CrmBillExpenseLine[] =
    entryMode === 'expenses'
      ? expenseRows
          .filter(
            (r) =>
              Number(r.amount) > 0 ||
              (r.description && r.description.length > 0),
          )
          .map(({ _key: _ignored, projectId: _proj, ...rest }) => rest)
      : [];

  const customFieldsForSubmit = useMemo(() => {
    return {
      ...customFieldValues,
      _reverseCharge: reverseCharge || undefined,
      _linkedPoId: linkedPoId || undefined,
      _linkedGrnIds: linkedGrnIds
        ? linkedGrnIds
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined,
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
    reverseCharge,
    linkedPoId,
    linkedGrnIds,
    recurringEnabled,
    recurringFrequency,
    recurringEnd,
    recurringNextRun,
  ]);

  const handleFormSubmit = React.useCallback(() => {
    setPendingIntent(submitIntent);
  }, [submitIntent]);

  return {
    /* refs / actions */
    formRef,
    formAction,
    editing,
    /* mode + lines */
    entryMode,
    setEntryMode: (v: EntryMode) => {
      setEntryMode(v);
      markDirty();
    },
    itemRows,
    addItemRow,
    removeItemRow,
    patchItemRow,
    expenseRows,
    addExpenseRow,
    removeExpenseRow,
    patchExpenseRow,
    /* state + setters */
    currency,
    setCurrency: (v: string) => {
      setCurrency(v);
      markDirty();
    },
    reverseCharge,
    setReverseCharge: (v: boolean) => {
      setReverseCharge(v);
      markDirty();
    },
    linkedPoId,
    setLinkedPoId: (v: string | null) => {
      setLinkedPoId(v);
      markDirty();
    },
    linkedGrnIds,
    setLinkedGrnIds: (v: string) => {
      setLinkedGrnIds(v);
      markDirty();
    },
    recurringEnabled,
    setRecurringEnabled: (v: boolean) => {
      setRecurringEnabled(v);
      markDirty();
    },
    recurringFrequency,
    setRecurringFrequency: (v: CrmBillRecurringFrequency | '') => {
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
    expenseLinesForSubmit,
    customFieldsForSubmit,
    dirty,
  };
}

export { toDateInput };
