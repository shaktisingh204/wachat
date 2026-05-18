/**
 * `/dashboard/crm/sales-crm/contacts/[contactId]/edit` — server-loaded edit form.
 *
 * Loads the contact via `getCrmContactById` and hands it to the shared
 * `<ContactForm>` used by `/new` with `mode="edit"`. The form action
 * dispatches to `updateCrmContact` instead of `addCrmContact`.
 */

import { notFound } from 'next/navigation';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ContactForm } from '../../_components/contacts-form';
import { getCrmContactById } from '@/app/actions/crm.actions';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ contactId: string }>;
}

export default async function EditContactPage({ params }: PageProps) {
    const { contactId } = await params;
    const contact = await getCrmContactById(contactId);
    if (!contact) notFound();

    return (
        <EntityListShell
            title="Edit Contact"
            subtitle={`Update the details for "${contact.name}".`}
        >
            <ContactForm
                mode="edit"
                initial={JSON.parse(JSON.stringify(contact))}
            />
        </EntityListShell>
    );
}
