/**
 * Edit a SabBigin booking page.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
} from '@/components/sabcrm/20ui';
import { getCrmPipelines } from '@/app/actions/crm-pipelines.actions';
import { getSabbiginBookingPage } from '@/app/actions/sabbigin-bookings.actions';
import { BookingBuilder } from '@/components/sabbigin/booking/booking-builder';

export const dynamic = 'force-dynamic';

export default async function EditBookingPage({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const { pageId } = await params;
  const [page, pipelines] = await Promise.all([
    getSabbiginBookingPage(pageId),
    getCrmPipelines(),
  ]);
  if (!page) notFound();

  const summaries = pipelines.map((p) => ({
    id: String(p.id),
    name: p.name,
    stageCount: p.stages?.length ?? 0,
  }));

  return (
    <div className="20ui flex w-full flex-col gap-5">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>
            <Link
              href="/dashboard/sabbigin/settings/booking"
              className="inline-flex items-center gap-1 hover:text-[var(--st-accent)]"
            >
              <ChevronLeft size={12} /> Booking pages
            </Link>
          </PageEyebrow>
          <PageTitle>{page.title}</PageTitle>
          <PageDescription>
            Public link: <code className="text-[var(--st-accent)]">/book/{page.slug}</code>
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <BookingBuilder initial={page} pipelines={summaries} />
    </div>
  );
}
