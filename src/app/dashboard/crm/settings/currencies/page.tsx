'use client';

import { useTransition } from 'react';
import { CircleDollarSign, Star } from 'lucide-react';

import { ClayBadge } from '@/components/clay';
import { HrEntityPage } from '../../_components/hr-entity-page';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  getCurrencies,
  saveCurrency,
  deleteCurrency,
  setDefaultCurrency,
} from '@/app/actions/worksuite/company.actions';
import type { WsCurrency } from '@/lib/worksuite/company-types';

function SetDefaultButton({ id, isDefault }: { id: string; isDefault: boolean }) {
  const [pending, start] = useTransition();
  const { toast } = useToast();
  if (isDefault) {
    return (
      <ClayBadge tone="green" dot>
        Default
      </ClayBadge>
    );
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await setDefaultCurrency(id);
          if (r.success) toast({ title: 'Default currency updated.' });
          else
            toast({
              title: 'Error',
              description: r.error,
              variant: 'destructive',
            });
        })
      }
      className="text-[12px] text-clay-ink-muted"
    >
      <Star className="mr-1 h-3.5 w-3.5" /> Set default
    </Button>
  );
}

export default function CurrenciesPage() {
  return (
    <HrEntityPage<WsCurrency & { _id: string }>
      title="Currencies"
      subtitle="Available currencies, symbols, exchange rates, and formatting preferences."
      icon={CircleDollarSign}
      singular="Currency"
      getAllAction={getCurrencies as any}
      saveAction={saveCurrency}
      deleteAction={deleteCurrency}
      columns={[
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Name' },
        { key: 'symbol', label: 'Symbol' },
        {
          key: 'exchange_rate',
          label: 'Rate',
          render: (row) =>
            row.exchange_rate != null ? String(row.exchange_rate) : '—',
        },
        {
          key: 'is_cryptocurrency',
          label: 'Crypto',
          render: (row) => (
            <ClayBadge tone={row.is_cryptocurrency ? 'amber' : 'neutral'}>
              {row.is_cryptocurrency ? 'Yes' : 'No'}
            </ClayBadge>
          ),
        },
        {
          key: 'default',
          label: 'Default',
          render: (row) => (
            <SetDefaultButton
              id={String(row._id)}
              isDefault={Boolean(row.default)}
            />
          ),
        },
      ]}
      fields={[
        { name: 'code', label: 'Code (ISO 4217)', required: true, placeholder: 'USD' },
        { name: 'name', label: 'Name', required: true, placeholder: 'US Dollar' },
        { name: 'symbol', label: 'Symbol', placeholder: '$' },
        { name: 'exchange_rate', label: 'Exchange Rate', type: 'number' },
        { name: 'usd_price', label: 'USD Price', type: 'number' },
        {
          name: 'is_cryptocurrency',
          label: 'Cryptocurrency',
          type: 'select',
          options: [
            { value: 'no', label: 'No' },
            { value: 'yes', label: 'Yes' },
          ],
          defaultValue: 'no',
        },
        { name: 'decimal_separator', label: 'Decimal Separator', placeholder: '.' },
        { name: 'thousand_separator', label: 'Thousand Separator', placeholder: ',' },
        { name: 'decimal_digits', label: 'Decimal Digits', type: 'number', defaultValue: '2' },
        {
          name: 'currency_position',
          label: 'Symbol Position',
          type: 'select',
          defaultValue: 'front',
          options: [
            { value: 'front', label: 'Front ($1)' },
            { value: 'back', label: 'Back (1$)' },
            { value: 'front-space', label: 'Front with space ($ 1)' },
            { value: 'back-space', label: 'Back with space (1 $)' },
          ],
        },
        {
          name: 'default',
          label: 'Default Currency',
          type: 'select',
          options: [
            { value: 'no', label: 'No' },
            { value: 'yes', label: 'Yes' },
          ],
          defaultValue: 'no',
        },
      ]}
    />
  );
}
