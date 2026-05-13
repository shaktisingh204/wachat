/**
 * Warehouse detail page — server component.
 *
 * Linked from the warehouses list. Uses <EntityDetailShell> with eyebrow,
 * title, back link, status pill, and an "Edit" action.
 *
 * Fetches the warehouse via `getCrmWarehouseById`. Activity footer is
 * rendered via `audit: { entityKind: 'warehouse', entityId }`.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Pencil } from 'lucide-react';

import {
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
} from '@/components/zoruui';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getCrmWarehouseById } from '@/app/actions/crm-warehouses.actions';

interface PageProps {
  params: Promise<{ id: string }>;
}

function fmt(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

export default async function WarehouseDetailPage({ params }: PageProps) {
  const { id } = await params;
  const warehouse = await getCrmWarehouseById(id);
  if (!warehouse) notFound();

  return (
    <EntityDetailShell
      eyebrow="WAREHOUSE"
      title={warehouse.name}
      status={
        warehouse.isDefault
          ? { label: 'Default', tone: 'blue' }
          : { label: 'Active', tone: 'green' }
      }
      back={{
        href: '/dashboard/crm/inventory/warehouses',
        label: 'Back to all warehouses',
      }}
      actions={
        <>
          <ZoruButton variant="outline" size="sm" asChild>
            <Link href={`/dashboard/crm/inventory/warehouses/${id}/activity`}>
              View activity
            </Link>
          </ZoruButton>
          <ZoruButton size="sm" asChild>
            <Link href={`/dashboard/crm/inventory/warehouses/${id}/edit`}>
              <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
              Edit
            </Link>
          </ZoruButton>
        </>
      }
      audit={{ entityKind: 'warehouse', entityId: id }}
    >
      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Location</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="text-xs text-zinc-500">Address</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">
                {fmt(warehouse.address)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">City</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">{fmt(warehouse.city)}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">State</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">{fmt(warehouse.state)}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Country</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">
                {fmt(warehouse.country)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Pincode</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">
                {fmt(warehouse.pincode)}
              </dd>
            </div>
          </dl>
        </ZoruCardContent>
      </ZoruCard>

      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Contact</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-zinc-500">Manager</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">
                {fmt(warehouse.managerName)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Phone</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">{fmt(warehouse.phone)}</dd>
            </div>
          </dl>
        </ZoruCardContent>
      </ZoruCard>
    </EntityDetailShell>
  );
}
