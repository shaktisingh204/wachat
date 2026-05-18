import {
  notFound,
  redirect } from 'next/navigation';

/**
 * Edit custom form — server wrapper that loads the form by id and
 * hands it to `<CustomFormForm />` as `initialData`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';
import { getFormById } from '@/app/actions/crm-forms.actions';

import { CustomFormForm } from '../../_components/custom-form-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/tickets/custom-forms';

export default async function EditCustomFormPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getSession();
  if (!session?.user) redirect('/login');

  const form = await getFormById(id);
  if (!form) notFound();

  return (
    <EntityDetailShell
      eyebrow="CUSTOM FORM"
      title={`Edit · ${form.name}`}
      back={{ href: `${BASE}/${id}`, label: 'Back to detail' }}
    >
      <CustomFormForm initialData={form} />
    </EntityDetailShell>
  );
}
