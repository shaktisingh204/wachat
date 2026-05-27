/**
 * Public event landing page — `/event/[pageSlug]`.
 *
 * Server-renders the page chrome (hero, headline, description) using
 * `loadPublicEventPage(slug)`, which hits the unauthenticated Rust
 * resolver `/v1/sabbackstage/public-pages/public/by-slug/:slug`.
 *
 * Ticket selection + checkout is delegated to a client island
 * `<PublicTicketBookingForm>` so the user can adjust quantities and
 * submit to the order-creation server action.
 */
import { notFound } from 'next/navigation';

import { loadPublicEventPage } from '@/app/actions/sabbackstage-public.actions';
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
      style={{ backgroundColor: bg, color: '#fff', minHeight: '100vh' }}
      className="px-4 py-10 md:px-12"
    >
      <section className="mx-auto max-w-5xl">
        {page.page.heroImageFileId ? (
          <div
            className="mb-6 h-64 w-full rounded-xl bg-cover bg-center"
            style={{
              backgroundImage: `url(/api/sabfiles/${page.page.heroImageFileId})`,
            }}
            role="img"
            aria-label="Event hero image"
          />
        ) : null}
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
          {page.page.headline}
        </h1>
        {page.page.description ? (
          <p className="mt-4 max-w-2xl whitespace-pre-wrap text-base opacity-80">
            {page.page.description}
          </p>
        ) : null}

        <div className="mt-10">
          <h2
            className="text-xl font-semibold"
            style={{ color: accent }}
          >
            Book tickets
          </h2>
          {ticketTypes.length === 0 ? (
            <p className="mt-3 text-sm opacity-70">
              No tickets on sale yet. Please check back soon.
            </p>
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
            <h2
              className="text-base font-semibold uppercase tracking-wider opacity-70"
            >
              Our sponsors
            </h2>
            <PublicSponsorStrip sponsors={sponsors} />
          </div>
        ) : null}
      </section>
    </main>
  );
}
