/**
 * SabBigin contact detail — native, fully-editable.
 *
 * Replaces the old read-only summary card (which delegated edits to the
 * hidden full CRM). Fetches the contact, its activity timeline and its
 * related deals, then hands everything to `<ContactDetailClient>` for
 * inline editing, a notes composer and the timeline feed.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageActions,
} from '@/components/sabcrm/20ui';

import { getCrmContactById, getCrmEntityTimeline } from '@/app/actions/crm.actions';
import { getSabbiginContactDeals } from '@/app/actions/sabbigin-contacts.actions';

import {
  ContactDetailClient,
  type ContactDetailProps,
} from './_components/contact-detail-client';
import type { TimelineItem } from '@/components/sabbigin/timeline/entity-timeline';
import { ContactCommsBar } from '@/components/sabbigin/comms/contact-comms-bar';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ contactId: string }>;
}

export default async function SabbiginContactDetailPage({ params }: PageProps) {
  const { contactId } = await params;

  const contact = await getCrmContactById(contactId);
  if (!contact) notFound();

  const [timeline, deals] = await Promise.all([
    getCrmEntityTimeline('contact', contactId).catch(() => ({
      success: false,
      items: [] as any[],
    })),
    getSabbiginContactDeals(contactId).catch(() => []),
  ]);

  const timelineItems: TimelineItem[] = ((timeline as any)?.items ?? []).map(
    (it: any) => ({
      id: String(it.id),
      type: it.type,
      title: it.title,
      body: it.body,
      timestamp: it.createdAt ?? it.timestamp ?? null,
      actorName: it.actorName ?? null,
    }),
  );

  const name = contact.name ?? 'Contact';

  const props: ContactDetailProps = {
    contactId,
    name,
    email: contact.email ?? '',
    phone: contact.phone ?? '',
    company: contact.company ?? '',
    jobTitle: contact.jobTitle ?? '',
    status: String(contact.status ?? ''),
    source: (contact.leadSource ?? contact.source ?? '') as string,
    timeline: timelineItems,
    deals,
  };

  return (
    <div className="20ui flex w-full flex-col gap-5">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabBigin · Contact</PageEyebrow>
          <PageTitle>{name}</PageTitle>
        </PageHeaderHeading>
        <PageActions>
          <Link
            href="/dashboard/sabbigin/contacts"
            className="u-btn u-btn--ghost u-btn--sm"
          >
            <ArrowLeft size={13} aria-hidden="true" />
            <span className="u-btn__label">Back</span>
          </Link>
        </PageActions>
      </PageHeader>

      <ContactCommsBar
        contactId={contactId}
        email={contact.email ?? ''}
        phone={contact.phone ?? ''}
      />

      <ContactDetailClient {...props} />
    </div>
  );
}
