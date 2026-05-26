import { redirect } from 'next/navigation';

/**
 * New custom form — server wrapper around `<CustomFormForm />`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';

import { CustomFormForm } from '../_components/custom-form-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/sabdesk/custom-forms';

export default async function NewCustomFormPage() {
  const session = await getSession();
  if (!session?.user) redirect('/login');

  return (
    <EntityDetailShell
      eyebrow="CUSTOM FORM"
      title="New custom form"
      back={{ href: BASE, label: 'Custom Forms' }}
    >
      <CustomFormForm />
    </EntityDetailShell>
  );
}
