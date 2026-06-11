/**
 * Public SabBigin booking page — no auth required. Renders availability and a
 * self-scheduling widget. Mirrors the public hosting pattern of
 * `/p/lead-form/[formId]`.
 */

import type { Metadata } from 'next';

import { getPublicBookingSlots } from '@/app/actions/sabbigin-bookings.actions';
import { PublicBookingForm } from '@/components/sabbigin/booking/public-booking-form';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { page } = await getPublicBookingSlots(slug);
  return { title: page ? `Book — ${page.title}` : 'Book a time' };
}

export default async function PublicBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { page, days } = await getPublicBookingSlots(slug);

  if (!page) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-800">Page not found</h1>
          <p className="mt-1 text-sm text-gray-500">
            This booking link may have been removed.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">{page.title}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {page.durationMin} min · {page.timezone}
          </p>
          {page.description && (
            <p className="mt-3 text-sm text-gray-600">{page.description}</p>
          )}
        </header>
        <PublicBookingForm page={page} days={days} />
        <p className="mt-8 text-center text-xs text-gray-400">
          Powered by SabBigin
        </p>
      </div>
    </main>
  );
}
