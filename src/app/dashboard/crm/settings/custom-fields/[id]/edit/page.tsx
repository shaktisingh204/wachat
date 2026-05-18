import {
  notFound,
  redirect } from 'next/navigation';

/**
 * Edit custom field page — server wrapper that loads the field via the
 * Rust-backed `getCustomFieldById` action and hands it to the shared
 * `<CustomFieldForm />` client island.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';
import { getCustomFieldById } from '@/app/actions/crm-custom-fields.actions';

import { CustomFieldForm } from '../../_components/custom-field-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/settings/custom-fields';

export default async function EditCustomFieldPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getSession();
  if (!session?.user) redirect('/login');

  const field = await getCustomFieldById(id);
  if (!field) notFound();

  return (
    <EntityDetailShell
      eyebrow="CUSTOM FIELD"
      title={`Edit · ${field.label}`}
      back={{ href: `${BASE}/${id}`, label: field.label }}
    >
      <CustomFieldForm initialData={field} />
    </EntityDetailShell>
  );
}
