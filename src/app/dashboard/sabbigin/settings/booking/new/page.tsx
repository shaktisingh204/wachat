/**
 * Create a new SabBigin booking page.
 */
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
} from '@/components/sabcrm/20ui';
import { getCrmPipelines } from '@/app/actions/crm-pipelines.actions';
import { BookingBuilder } from '@/components/sabbigin/booking/booking-builder';

export const dynamic = 'force-dynamic';

export default async function NewBookingPage() {
  const pipelines = await getCrmPipelines();
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
          <PageTitle>New booking page</PageTitle>
          <PageDescription>
            Let people self-schedule. Bookings create a contact and a meeting
            automatically.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <BookingBuilder initial={null} pipelines={summaries} />
    </div>
  );
}
