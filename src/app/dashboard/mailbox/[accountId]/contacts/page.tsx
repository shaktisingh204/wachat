/**
 * Webmail address book — server shell.
 */

import { listMailContacts } from '@/app/actions/mailbox.actions';

import { ContactsClient } from './contacts-client';

export const dynamic = 'force-dynamic';

export default async function MailboxContactsPage({
    params,
}: {
    params: Promise<{ accountId: string }>;
}) {
    const { accountId } = await params;
    const contacts = await listMailContacts(accountId);
    return <ContactsClient accountId={accountId} initialContacts={contacts} />;
}
