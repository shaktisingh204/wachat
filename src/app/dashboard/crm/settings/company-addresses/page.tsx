'use client';

import { useTransition } from 'react';
import { MapPin, Star } from 'lucide-react';

import { ClayBadge } from '@/components/clay';
import { HrEntityPage } from '../../hr/_components/hr-entity-page';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  getCompanyAddresses,
  saveCompanyAddress,
  deleteCompanyAddress,
  setDefaultCompanyAddress,
} from '@/app/actions/worksuite/company.actions';
import type { WsCompanyAddress } from '@/lib/worksuite/company-types';

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
          const r = await setDefaultCompanyAddress(id);
          if (r.success)
            toast({ title: 'Default address updated.' });
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

export default function CompanyAddressesPage() {
  return (
    <HrEntityPage<WsCompanyAddress & { _id: string }>
      title="Company Addresses"
      subtitle="Offices, branches, warehouses, and billing/shipping endpoints."
      icon={MapPin}
      singular="Address"
      getAllAction={getCompanyAddresses as any}
      saveAction={saveCompanyAddress}
      deleteAction={deleteCompanyAddress}
      columns={[
        {
          key: 'type',
          label: 'Type',
          render: (row) => (
            <ClayBadge tone="rose-soft">{row.type || 'office'}</ClayBadge>
          ),
        },
        { key: 'address', label: 'Address' },
        { key: 'city', label: 'City' },
        { key: 'country_id', label: 'Country' },
        {
          key: 'is_default',
          label: 'Default',
          render: (row) => (
            <SetDefaultButton
              id={String(row._id)}
              isDefault={Boolean(row.is_default)}
            />
          ),
        },
      ]}
      fields={[
        {
          name: 'type',
          label: 'Type',
          type: 'select',
          required: true,
          defaultValue: 'office',
          options: [
            { value: 'office', label: 'Office' },
            { value: 'branch', label: 'Branch' },
            { value: 'warehouse', label: 'Warehouse' },
            { value: 'billing', label: 'Billing' },
            { value: 'shipping', label: 'Shipping' },
          ],
        },
        {
          name: 'address',
          label: 'Address',
          type: 'textarea',
          required: true,
          fullWidth: true,
        },
        { name: 'city', label: 'City' },
        { name: 'state', label: 'State' },
        { name: 'country_id', label: 'Country Code / ID' },
        { name: 'postal_code', label: 'Postal Code' },
        {
          name: 'is_default',
          label: 'Set as Default',
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
