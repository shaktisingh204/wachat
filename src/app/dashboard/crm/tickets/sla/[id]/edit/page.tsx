import {
  notFound,
  redirect } from 'next/navigation';

/**
 * Edit SLA — server wrapper that loads the SLA by id and hands it to
 * `<SlaForm />` as `initialData`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';
import { getSlaById } from '@/app/actions/crm-sla.actions';

import { SlaForm } from '../../_components/sla-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/tickets/sla';

export default async function EditSlaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getSession();
  if (!session?.user) redirect('/login');

  const sla = await getSlaById(id);
  if (!sla) notFound();

  return (
    <EntityDetailShell
      eyebrow="SLA POLICY"
      title={`Edit · ${sla.name}`}
      back={{ href: `${BASE}/${id}`, label: 'Back to detail' }}
    >
      <SlaForm initialData={sla} />
    </EntityDetailShell>
  );
}
