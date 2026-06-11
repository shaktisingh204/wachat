/**
 * SabBigin deal detail — native, fully-editable.
 *
 * Server page: fetches the deal, its pipeline (for the stage stepper +
 * governance), related-entity counts, the activity timeline and the linked
 * contact name. Everything serialisable is handed to the
 * `<DealDetailClient>` island, which owns inline editing, the stage
 * stepper, the notes composer and the tabbed body.
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

import { getCrmDealById, getCrmDealRelatedCounts } from '@/app/actions/crm-deals.actions';
import { getPipelineById } from '@/app/actions/crm-pipelines.actions';
import { getCrmEntityTimeline, getCrmContactById } from '@/app/actions/crm.actions';

import { DealDetailClient, type DealDetailProps } from './_components/deal-detail-client';
import type { TimelineItem } from '@/components/sabbigin/timeline/entity-timeline';
import { EmailComposeButton } from '@/components/sabbigin/comms/email-compose-button';
import { WhatsAppButton } from '@/components/sabbigin/comms/whatsapp-button';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ dealId: string }>;
}

export default async function SabbiginDealDetailPage({ params }: PageProps) {
  const { dealId } = await params;

  const deal = await getCrmDealById(dealId);
  if (!deal) notFound();

  const pipelineId = deal.pipelineId ? String(deal.pipelineId) : '';

  const [pipeline, counts, timeline] = await Promise.all([
    pipelineId ? getPipelineById(pipelineId) : Promise.resolve(null),
    getCrmDealRelatedCounts(dealId).catch(() => ({
      quotations: 0,
      invoices: 0,
      tasks: 0,
      tickets: 0,
      contacts: 0,
    })),
    getCrmEntityTimeline('deal', dealId).catch(() => ({ success: false, items: [] as any[] })),
  ]);

  // Resolve the primary contact label (best-effort).
  let contactName: string | null = null;
  let contactId: string | null = null;
  let contactEmail: string | null = null;
  const firstContact = Array.isArray(deal.contactIds) ? deal.contactIds[0] : undefined;
  if (firstContact) {
    contactId = String(firstContact);
    try {
      const c = await getCrmContactById(contactId);
      contactName = c?.name ?? null;
      contactEmail = c?.email ?? null;
    } catch {
      contactName = null;
    }
  }

  // Pipeline stages — ordered names for the stepper. Fall back to a single
  // synthetic stage so the stepper always renders the current state.
  const stages: { id: string; name: string; probability: number | null }[] = (
    pipeline?.stages ?? []
  )
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((s, i) => ({
      id: String(s._id ?? s.id ?? i),
      name: s.name ?? '',
      probability: typeof s.probability === 'number' ? s.probability : null,
    }));

  const currentStage = String(deal.stage ?? stages[0]?.name ?? 'New');
  if (currentStage && !stages.some((s) => s.name === currentStage)) {
    // Deal sits on a stage not in the pipeline (renamed/legacy). Show it too.
    stages.push({ id: `current-${currentStage}`, name: currentStage, probability: null });
  }

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

  const props: DealDetailProps = {
    dealId,
    pipelineId,
    name: deal.name ?? 'Untitled deal',
    value: typeof deal.value === 'number' ? deal.value : 0,
    currency: deal.currency ?? 'INR',
    stage: currentStage,
    probability: typeof deal.probability === 'number' ? deal.probability : null,
    closeDate: deal.closeDate ? new Date(deal.closeDate as any).toISOString() : null,
    description: deal.description ?? '',
    nextStep: (deal as any).nextStep ?? '',
    priority: (deal.priority as DealDetailProps['priority']) ?? null,
    ownerId: deal.ownerId ? String(deal.ownerId) : null,
    contactId,
    contactName,
    products: Array.isArray((deal as any).products)
      ? (deal as any).products.map((p: any) => ({
          name: String(p?.name ?? 'Line item'),
          quantity: Number(p?.quantity ?? 1) || 1,
          price: Number(p?.price ?? 0) || 0,
        }))
      : [],
    stages,
    counts,
    timeline: timelineItems,
  };

  return (
    <div className="20ui flex w-full flex-col gap-5">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabBigin · Deal</PageEyebrow>
          <PageTitle>{props.name}</PageTitle>
        </PageHeaderHeading>
        <PageActions>
          <EmailComposeButton
            dealId={dealId}
            contactId={contactId ?? undefined}
            defaultTo={contactEmail ?? undefined}
          />
          {contactId ? <WhatsAppButton contactId={contactId} /> : null}
          <Link
            href={
              pipelineId
                ? `/dashboard/sabbigin/deals?pipeline=${encodeURIComponent(pipelineId)}`
                : '/dashboard/sabbigin/deals'
            }
            className="u-btn u-btn--ghost u-btn--sm"
          >
            <ArrowLeft size={13} aria-hidden="true" />
            <span className="u-btn__label">Back to pipeline</span>
          </Link>
        </PageActions>
      </PageHeader>

      <DealDetailClient {...props} />
    </div>
  );
}
