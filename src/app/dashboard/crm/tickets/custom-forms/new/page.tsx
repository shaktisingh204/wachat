import { ZoruButton } from '@/components/zoruui';
import { redirect } from 'next/navigation';
import { ArrowLeft, FormInput } from 'lucide-react';

/**
 * New custom form — server wrapper around `<CustomFormForm />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';

import { CustomFormForm } from '../_components/custom-form-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/tickets/custom-forms';

export default async function NewCustomFormPage() {
  const session = await getSession();
  if (!session?.user) redirect('/login');

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        breadcrumbs={[
          { label: 'Tickets', href: '/dashboard/crm/tickets' },
          { label: 'Custom Forms', href: BASE },
          { label: 'New' },
        ]}
        title="New custom form"
        subtitle="Define the fields that ticket creators will fill in."
        icon={FormInput}
        actions={
          <ZoruButton variant="ghost" asChild>
            <Link href={BASE}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to list
            </Link>
          </ZoruButton>
        }
      />

      <CustomFormForm />
    </div>
  );
}
