/**
 * Edit contact — `/dashboard/crm/sales/contacts/[contactId]/edit`.
 *
 * Server component: fetches via `getCrmContactById` (which already
 * dual-dispatches Rust/Mongo internally) and passes the contact to a
 * client form that submits `updateCrmContact`.
 */

import { notFound } from 'next/navigation';
import { Users } from 'lucide-react';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
import { getCrmContactById } from '@/app/actions/crm.actions';
import { EditContactForm } from './edit-form';

export const dynamic = 'force-dynamic';

export default async function EditSalesContactPage({
    params,
}: {
    params: Promise<{ contactId: string }>;
}) {
    const { contactId } = await params;
    const contact = await getCrmContactById(contactId);
    if (!contact) notFound();

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title={`Edit ${contact.name ?? 'contact'}`}
                subtitle="Update contact details, lifecycle and tags."
                icon={Users}
            />
            <EditContactForm
                contactId={contactId}
                initial={JSON.parse(JSON.stringify(contact))}
            />
        </div>
    );
}
