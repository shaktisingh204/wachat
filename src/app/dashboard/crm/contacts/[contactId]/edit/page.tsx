/**
 * Edit Contact — server wrapper that fetches by id and hands the doc
 * to the client form. Matches the budgets/[id]/edit pattern.
 */

import { notFound } from 'next/navigation';

import { getCrmContactById } from '@/app/actions/crm.actions';
import { EditContactForm } from './edit-contact-form';

interface PageProps {
  params: Promise<{ contactId: string }>;
}

export default async function EditContactPage({ params }: PageProps) {
  const { contactId } = await params;
  const contact = await getCrmContactById(contactId);
  if (!contact) notFound();

  const initial = {
    _id: contact._id.toString(),
    accountId: contact.accountId?.toString() ?? null,
    name: contact.name ?? '',
    email: contact.email ?? '',
    phone: contact.phone ?? '',
    company: contact.company ?? '',
    jobTitle: contact.jobTitle ?? '',
    status: contact.status ?? 'new_lead',
    leadScore: contact.leadScore ?? 0,
    linkedinUrl: contact.linkedinUrl ?? '',
    twitterHandle: contact.twitterHandle ?? '',
    lifecycleStage: contact.lifecycleStage ?? '',
    source: contact.source ?? '',
    owner: contact.owner ?? '',
    tags: contact.tags ?? [],
    dateOfBirth: contact.dateOfBirth
      ? new Date(contact.dateOfBirth).toISOString().slice(0, 10)
      : '',
    timezone: contact.timezone ?? '',
  };

  return <EditContactForm initial={initial} />;
}
