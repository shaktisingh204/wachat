import { ZoruButton } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { ArrowLeft,
  Timer } from 'lucide-react';

/**
 * Edit SLA — server wrapper that loads the SLA by id and hands it to
 * `<SlaForm />` as `initialData`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
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
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        breadcrumbs={[
          { label: 'Tickets', href: '/dashboard/crm/tickets' },
          { label: 'SLA', href: BASE },
          { label: sla.name, href: `${BASE}/${id}` },
          { label: 'Edit' },
        ]}
        title={`Edit · ${sla.name}`}
        subtitle="Update SLA targets, escalation, and status."
        icon={Timer}
        actions={
          <ZoruButton variant="ghost" asChild>
            <Link href={`${BASE}/${id}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to detail
            </Link>
          </ZoruButton>
        }
      />

      <SlaForm initialData={sla} />
    </div>
  );
}
