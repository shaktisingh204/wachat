import { ZoruButton } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { ArrowLeft,
  Settings2 } from 'lucide-react';

/**
 * Edit custom field page — server wrapper that loads the field via the
 * Rust-backed `getCustomFieldById` action and hands it to the shared
 * `<CustomFieldForm />` client island.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
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
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        breadcrumbs={[
          { label: 'CRM', href: '/dashboard/crm' },
          { label: 'Settings', href: '/dashboard/crm/settings' },
          { label: 'Custom Fields', href: BASE },
          { label: field.label, href: `${BASE}/${id}` },
          { label: 'Edit' },
        ]}
        title={`Edit · ${field.label}`}
        subtitle="Update label, placeholder, validation, options and display flags."
        icon={Settings2}
        actions={
          <ZoruButton variant="ghost" asChild>
            <Link href={`${BASE}/${id}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to detail
            </Link>
          </ZoruButton>
        }
      />

      <CustomFieldForm initialData={field} />
    </div>
  );
}
