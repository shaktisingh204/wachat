/**
 * `/dashboard/crm/sales-crm/contacts/[contactId]/edit` — server-loaded edit form.
 *
 * Loads the contact via `getCrmContactById` and hands it to the shared
 * `<ContactForm>` used by `/new` with `mode="edit"`. The form action
 * dispatches to `updateCrmContact` instead of `addCrmContact`.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Edit } from 'lucide-react';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
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
        <div className="flex w-full flex-col gap-6">
            <div>
                <Link
                    href={`/dashboard/crm/sales-crm/contacts/${contactId}`}
                    className="inline-flex items-center gap-1.5 text-[12.5px] text-zoru-ink-muted hover:text-zoru-ink"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to contact
                </Link>
            </div>

            <CrmPageHeader
                title="Edit Contact"
                subtitle={`Update the details for "${contact.name}".`}
                icon={Edit}
            />

            <ContactForm
                mode="edit"
                initial={JSON.parse(JSON.stringify(contact))}
            />
        </div>
    );
}
