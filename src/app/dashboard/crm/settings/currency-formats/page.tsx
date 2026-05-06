'use client';

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';
import { Hash, LoaderCircle, Plus, Trash2 } from 'lucide-react';

import {
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSkeleton,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import { CrmPageHeader } from '../../_components/crm-page-header';
import {
  getCurrencyFormatSettings,
  saveCurrencyFormatSetting,
  deleteCurrencyFormatSetting,
} from '@/app/actions/worksuite/module-settings.actions';
import { getCurrencies } from '@/app/actions/worksuite/company.actions';
import type { WsCurrencyFormatSetting } from '@/lib/worksuite/module-settings-types';
import type { WsCurrency } from '@/lib/worksuite/company-types';

type FormState = { message?: string; error?: string; id?: string };
const initialState: FormState = {};

type Row = WsCurrencyFormatSetting & { _id: string };

export default function CurrencyFormatsPage() {
  const { toast } = useZoruToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [currencies, setCurrencies] = useState<(WsCurrency & { _id: string })[]>(
    [],
  );
  const [isLoading, startLoading] = useTransition();
  const [currencyId, setCurrencyId] = useState('');
  const [position, setPosition] =
    useState<WsCurrencyFormatSetting['position']>('front');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, startDeleting] = useTransition();

  const [saveState, formAction, isSaving] = useActionState(
    saveCurrencyFormatSetting,
    initialState,
  );

  const refresh = useCallback(() => {
    startLoading(async () => {
      const [r, c] = await Promise.all([
        getCurrencyFormatSettings(),
        getCurrencies(),
      ]);
      setRows(r as unknown as Row[]);
      setCurrencies(c as unknown as (WsCurrency & { _id: string })[]);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (saveState?.message) {
      toast({ title: 'Saved', description: saveState.message });
      refresh();
      setCurrencyId('');
      setPosition('front');
    }
    if (saveState?.error) {
      toast({
        title: 'Error',
        description: saveState.error,
        variant: 'destructive',
      });
    }
  }, [saveState, toast, refresh]);

  const currencyById = useMemo(() => {
    const m = new Map<string, WsCurrency & { _id: string }>();
    currencies.forEach((c) => m.set(String(c._id), c));
    return m;
  }, [currencies]);

  const handleDelete = (id: string) => {
    setDeletingId(id);
    startDeleting(async () => {
      const r = await deleteCurrencyFormatSetting(id);
      setDeletingId(null);
      if (r.success) {
        toast({ title: 'Deleted' });
        refresh();
      } else {
        toast({
          title: 'Error',
          description: r.error,
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Currency Formats"
        subtitle="Per-currency display rules — symbol position, separators, and decimal precision."
        icon={Hash}
      />

      <ZoruCard className="p-6">
        <form action={formAction} className="space-y-4">
          <h3 className="text-[13px] uppercase tracking-wide text-zoru-ink-muted">
            Add or Update Format
          </h3>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <ZoruLabel htmlFor="currency_id" className="text-[13px] text-zoru-ink">
                Currency
              </ZoruLabel>
              <ZoruSelect
                name="currency_id"
                value={currencyId}
                onValueChange={setCurrencyId}
              >
                <ZoruSelectTrigger id="currency_id" className="mt-1.5">
                  <ZoruSelectValue placeholder="Select currency" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {currencies.map((c) => (
                    <ZoruSelectItem key={String(c._id)} value={String(c._id)}>
                      {c.code} — {c.name}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </ZoruSelect>
            </div>
            <div>
              <ZoruLabel htmlFor="position" className="text-[13px] text-zoru-ink">
                Symbol Position
              </ZoruLabel>
              <ZoruSelect
                name="position"
                value={position ?? 'front'}
                onValueChange={(v) =>
                  setPosition(v as WsCurrencyFormatSetting['position'])
                }
              >
                <ZoruSelectTrigger id="position" className="mt-1.5">
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="front">Front ($1)</ZoruSelectItem>
                  <ZoruSelectItem value="back">Back (1$)</ZoruSelectItem>
                  <ZoruSelectItem value="front-space">Front with space ($ 1)</ZoruSelectItem>
                  <ZoruSelectItem value="back-space">Back with space (1 $)</ZoruSelectItem>
                </ZoruSelectContent>
              </ZoruSelect>
            </div>
            <div>
              <ZoruLabel
                htmlFor="decimal_separator"
                className="text-[13px] text-zoru-ink"
              >
                Decimal Separator
              </ZoruLabel>
              <ZoruInput
                id="decimal_separator"
                name="decimal_separator"
                defaultValue="."
                className="mt-1.5"
              />
            </div>
            <div>
              <ZoruLabel
                htmlFor="thousand_separator"
                className="text-[13px] text-zoru-ink"
              >
                Thousand Separator
              </ZoruLabel>
              <ZoruInput
                id="thousand_separator"
                name="thousand_separator"
                defaultValue=","
                className="mt-1.5"
              />
            </div>
            <div>
              <ZoruLabel
                htmlFor="decimal_digits"
                className="text-[13px] text-zoru-ink"
              >
                Decimal Digits
              </ZoruLabel>
              <ZoruInput
                id="decimal_digits"
                name="decimal_digits"
                type="number"
                min={0}
                defaultValue="2"
                className="mt-1.5"
              />
            </div>
            <div>
              <ZoruLabel
                htmlFor="no_of_decimal"
                className="text-[13px] text-zoru-ink"
              >
                No. of Decimal
              </ZoruLabel>
              <ZoruInput
                id="no_of_decimal"
                name="no_of_decimal"
                type="number"
                min={0}
                defaultValue="2"
                className="mt-1.5"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <ZoruButton type="submit" disabled={isSaving || !currencyId}>
              {isSaving ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Save Format
            </ZoruButton>
          </div>
        </form>
      </ZoruCard>

      <ZoruCard className="p-6">
        {isLoading && rows.length === 0 ? (
          <ZoruSkeleton className="h-[200px] w-full" />
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-zoru-ink-muted">
            No currency formats configured.
          </div>
        ) : (
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow>
                <ZoruTableHead>Currency</ZoruTableHead>
                <ZoruTableHead>Position</ZoruTableHead>
                <ZoruTableHead>Decimal</ZoruTableHead>
                <ZoruTableHead>Thousand</ZoruTableHead>
                <ZoruTableHead>Digits</ZoruTableHead>
                <ZoruTableHead className="w-[80px] text-right">Actions</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {rows.map((row) => {
                const c = currencyById.get(String(row.currency_id));
                return (
                  <ZoruTableRow key={String(row._id)}>
                    <ZoruTableCell>
                      {c ? `${c.code} — ${c.name}` : '—'}
                    </ZoruTableCell>
                    <ZoruTableCell>{row.position ?? '—'}</ZoruTableCell>
                    <ZoruTableCell>{row.decimal_separator ?? '—'}</ZoruTableCell>
                    <ZoruTableCell>{row.thousand_separator ?? '—'}</ZoruTableCell>
                    <ZoruTableCell>
                      {row.no_of_decimal ?? row.decimal_digits ?? '—'}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right">
                      <ZoruButton
                        variant="ghost"
                        size="sm"
                        disabled={isDeleting && deletingId === String(row._id)}
                        onClick={() => handleDelete(String(row._id))}
                      >
                        <Trash2 className="h-4 w-4 text-zoru-ink-muted" />
                      </ZoruButton>
                    </ZoruTableCell>
                  </ZoruTableRow>
                );
              })}
            </ZoruTableBody>
          </ZoruTable>
        )}
      </ZoruCard>
    </div>
  );
}
