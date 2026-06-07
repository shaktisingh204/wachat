/**
 * Public event landing page - `/event/[pageSlug]`.
 *
 * Server-renders the page chrome (hero, headline, description) using
 * `loadPublicEventPage(slug)`, which hits the unauthenticated Rust
 * resolver `/v1/sabbackstage/public-pages/public/by-slug/:slug`.
 *
 * Ticket selection + checkout is delegated to a client island
 * `<PublicTicketBookingForm>` so the user can adjust quantities and
 * submit to the order-creation server action.
 *
 * Built on the 20ui design system. The page is scoped `ui20 dark` so 20ui
 * primitives render light-on-dark to suit the typical dark event theme; the
 * user-picked `background` + `accent` colours stay as runtime inline values.
 */
import { notFound } from 'next/navigation';
import { Ticket } from 'lucide-react';

import { loadPublicEventPage } from '@/app/actions/sabbackstage-public.actions';
import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  EmptyState,
} from '@/components/sabcrm/20ui';
import { PublicTicketBookingForm } from './_components/public-ticket-booking-form';
import { PublicSponsorStrip } from './_components/public-sponsor-strip';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ pageSlug: string }>;
}

export default async function PublicEventPage({ params }: PageProps) {
  const { pageSlug } = await params;
  const result = await loadPublicEventPage(pageSlug);
  if (!result.ok) notFound();
  const { page, ticketTypes, sponsors } = result.data;
  const theme = (page.page.themeJson ?? {}) as {
    accent?: string;
    background?: string;
  };
  const bg = theme.background ?? '#0b0b10';
  const accent = theme.accent ?? '#7c3aed';

  return (
    <main
      className="ui20 dark min-h-screen px-4 py-10 md:px-12"
      style={{ backgroundColor: bg }}
    >
      <section className="mx-auto max-w-5xl">
        {page.page.heroImageFileId ? (
          <div
            className="mb-6 h-64 w-full rounded-[var(--st-radius)] bg-cover bg-center"
            style={{
              backgroundImage: `url(/api/sabfiles/${page.page.heroImageFileId})`,
            }}
            role="img"
            aria-label="Event hero image"
          />
        ) : null}

        <PageHeader bordered={false}>
          <PageHeaderHeading>
            <PageTitle className="text-4xl md:text-5xl">
              {page.page.headline}
            </PageTitle>
            {page.page.description ? (
              <PageDescription className="max-w-2xl whitespace-pre-wrap text-base">
                {page.page.description}
              </PageDescription>
            ) : null}
          </PageHeaderHeading>
        </PageHeader>

        <div className="mt-10">
          <h2
            className="text-xl font-semibold"
            style={{ color: accent }}
          >
            Book tickets
          </h2>
          {ticketTypes.length === 0 ? (
            <div className="mt-3">
              <EmptyState
                icon={Ticket}
                title="No tickets on sale yet"
                description="Tickets for this event have not been published. Please check back soon."
              />
            </div>
          ) : (
            <PublicTicketBookingForm
              pageSlug={pageSlug}
              eventId={page.eventId}
              ticketTypes={ticketTypes}
              accent={accent}
            />
          )}
        </div>

        {sponsors.length > 0 ? (
          <div className="mt-12">
            <h2 className="text-base font-semibold uppercase tracking-wider text-[var(--st-text-secondary)]">
              Our sponsors
            </h2>
            <PublicSponsorStrip sponsors={sponsors} />
          </div>
        ) : null}
      </section>
    </main>
  );
}
