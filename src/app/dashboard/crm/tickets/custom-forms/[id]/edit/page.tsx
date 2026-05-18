import { ZoruButton } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { ArrowLeft,
  FormInput } from 'lucide-react';

/**
 * Edit custom form — server wrapper that loads the form by id and
 * hands it to `<CustomFormForm />` as `initialData`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
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
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        breadcrumbs={[
          { label: 'Tickets', href: '/dashboard/crm/tickets' },
          { label: 'Custom Forms', href: BASE },
          { label: form.name, href: `${BASE}/${id}` },
          { label: 'Edit' },
        ]}
        title={`Edit · ${form.name}`}
        subtitle="Update fields, settings, and status."
        icon={FormInput}
        actions={
          <ZoruButton variant="ghost" asChild>
            <Link href={`${BASE}/${id}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to detail
            </Link>
          </ZoruButton>
        }
      />

      <CustomFormForm initialData={form} />
    </div>
  );
}
