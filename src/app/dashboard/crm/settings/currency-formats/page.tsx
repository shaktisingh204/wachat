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

import { ClayButton, ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
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

const inputClass =
  'h-10 rounded-lg border-border bg-card text-[13px]';

type Row = WsCurrencyFormatSetting & { _id: string };

export default function CurrencyFormatsPage() {
  const { toast } = useToast();
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

      <ClayCard>
        <form action={formAction} className="space-y-4">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
            Add or Update Format
          </h3>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="currency_id" className="text-[13px] text-foreground">
                Currency
              </Label>
              <Select
                name="currency_id"
                value={currencyId}
                onValueChange={setCurrencyId}
              >
                <SelectTrigger id="currency_id" className={`mt-1.5 ${inputClass}`}>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={String(c._id)} value={String(c._id)}>
                      {c.code} — {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="position" className="text-[13px] text-foreground">
                Symbol Position
              </Label>
              <Select
                name="position"
                value={position ?? 'front'}
                onValueChange={(v) =>
                  setPosition(v as WsCurrencyFormatSetting['position'])
                }
              >
                <SelectTrigger id="position" className={`mt-1.5 ${inputClass}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="front">Front ($1)</SelectItem>
                  <SelectItem value="back">Back (1$)</SelectItem>
                  <SelectItem value="front-space">Front with space ($ 1)</SelectItem>
                  <SelectItem value="back-space">Back with space (1 $)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label
                htmlFor="decimal_separator"
                className="text-[13px] text-foreground"
              >
                Decimal Separator
              </Label>
              <Input
                id="decimal_separator"
                name="decimal_separator"
                defaultValue="."
                className={`mt-1.5 ${inputClass}`}
              />
            </div>
            <div>
              <Label
                htmlFor="thousand_separator"
                className="text-[13px] text-foreground"
              >
                Thousand Separator
              </Label>
              <Input
                id="thousand_separator"
                name="thousand_separator"
                defaultValue=","
                className={`mt-1.5 ${inputClass}`}
              />
            </div>
            <div>
              <Label
                htmlFor="decimal_digits"
                className="text-[13px] text-foreground"
              >
                Decimal Digits
              </Label>
              <Input
                id="decimal_digits"
                name="decimal_digits"
                type="number"
                min={0}
                defaultValue="2"
                className={`mt-1.5 ${inputClass}`}
              />
            </div>
            <div>
              <Label
                htmlFor="no_of_decimal"
                className="text-[13px] text-foreground"
              >
                No. of Decimal
              </Label>
              <Input
                id="no_of_decimal"
                name="no_of_decimal"
                type="number"
                min={0}
                defaultValue="2"
                className={`mt-1.5 ${inputClass}`}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <ClayButton
              type="submit"
              variant="obsidian"
              disabled={isSaving || !currencyId}
              leading={
                isSaving ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )
              }
            >
              Save Format
            </ClayButton>
          </div>
        </form>
      </ClayCard>

      <ClayCard>
        {isLoading && rows.length === 0 ? (
          <Skeleton className="h-[200px] w-full" />
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-muted-foreground">
            No currency formats configured.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Currency</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Decimal</TableHead>
                <TableHead>Thousand</TableHead>
                <TableHead>Digits</TableHead>
                <TableHead className="w-[80px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const c = currencyById.get(String(row.currency_id));
                return (
                  <TableRow key={String(row._id)}>
                    <TableCell>
                      {c ? `${c.code} — ${c.name}` : '—'}
                    </TableCell>
                    <TableCell>{row.position ?? '—'}</TableCell>
                    <TableCell>{row.decimal_separator ?? '—'}</TableCell>
                    <TableCell>{row.thousand_separator ?? '—'}</TableCell>
                    <TableCell>
                      {row.no_of_decimal ?? row.decimal_digits ?? '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isDeleting && deletingId === String(row._id)}
                        onClick={() => handleDelete(String(row._id))}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </ClayCard>
    </div>
  );
}
