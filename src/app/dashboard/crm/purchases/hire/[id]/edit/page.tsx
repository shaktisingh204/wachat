/**
 * Edit hire request — `/dashboard/crm/purchases/hire/[id]/edit`.
 *
 * Server component: hydrates the hire request via `getCrmHireById` and
 * hands it to the client `<HireEditForm>` which calls the `updateCrmHire`
 * server action.
 */

import { notFound } from 'next/navigation';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getCrmHireById } from '@/app/actions/crm-hire.actions';
import { HireEditForm } from './hire-edit-form';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

function toISODate(value: unknown): string {
  if (!value) return '';
  const d = new Date(value as string | Date);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export default async function EditHireRequestPage({ params }: PageProps) {
  const { id } = await params;
  const hire = await getCrmHireById(id);
  if (!hire) notFound();

  return (
    <EntityListShell
      title={`Edit ${hire.title || 'hire request'}`}
      subtitle="Update vendor sourcing or service hiring request details."
    >
      <HireEditForm
        hireId={String(hire._id)}
        initial={{
          title: hire.title ?? '',
          category: hire.category ?? '',
          vendorCandidate: hire.vendorCandidate ?? '',
          requiredBy: toISODate(hire.requiredBy),
          quantity:
            typeof hire.quantity === 'number' ? String(hire.quantity) : '',
          estimatedBudget:
            typeof hire.estimatedBudget === 'number'
              ? String(hire.estimatedBudget)
              : '',
          specs: hire.specs ?? '',
          owner: hire.owner ?? '',
          stage: hire.stage ?? 'sourcing',
          status: hire.status ?? 'open',
        }}
      />
    </EntityListShell>
  );
}
