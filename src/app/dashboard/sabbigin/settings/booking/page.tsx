import Link from 'next/link';
import { ArrowLeft, CalendarClock, Clock, Plus } from 'lucide-react';
import { ObjectId } from 'mongodb';

import {
  Badge,
  Card,
  CardBody,
  EmptyState,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
} from '@/components/sabcrm/20ui';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

export const dynamic = 'force-dynamic';

const NEW_BOOKING_HREF = '/dashboard/sabbigin/settings/booking/new';

interface BookingPageLite {
  id: string;
  title: string;
  slug: string | null;
  durationMinutes: number | null;
  active: boolean;
}

/**
 * Reads `crm_booking_pages` directly (the booking module is owned by another
 * dev; this surface only lists what exists and degrades gracefully when the
 * collection is empty or absent).
 */
async function loadBookingPages(): Promise<BookingPageLite[]> {
  const session = await getSession();
  if (!session?.user?._id) return [];
  try {
    const { db } = await connectToDatabase();
    const rows = await db
      .collection<Record<string, unknown>>('crm_booking_pages')
      .find({ userId: new ObjectId(session.user._id) })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    return rows.map((r) => ({
      id: String(r._id),
      title:
        (typeof r.title === 'string' && r.title) ||
        (typeof r.name === 'string' && r.name) ||
        'Untitled booking page',
      slug: typeof r.slug === 'string' ? r.slug : null,
      durationMinutes:
        typeof r.durationMinutes === 'number'
          ? r.durationMinutes
          : typeof r.duration === 'number'
            ? r.duration
            : null,
      active: r.active !== false && r.status !== 'inactive',
    }));
  } catch (e) {
    console.error('[loadBookingPages] failed:', e);
    return [];
  }
}

export default async function SabbiginBookingSettingsPage() {
  const pages = await loadBookingPages();

  return (
    <div className="20ui flex w-full flex-col gap-5">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>
            <Link
              href="/dashboard/sabbigin/settings"
              className="inline-flex items-center gap-1 hover:text-[var(--st-text)]"
            >
              <ArrowLeft className="h-3 w-3" aria-hidden="true" />
              Settings
            </Link>
          </PageEyebrow>
          <PageTitle>Booking pages</PageTitle>
          <PageDescription>
            Share a link that lets people book time directly on your calendar.
            Each booking can create a contact and an activity automatically.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Link href={NEW_BOOKING_HREF} className="u-btn u-btn--primary u-btn--sm">
            <Plus size={13} aria-hidden="true" />
            <span className="u-btn__label">New booking page</span>
          </Link>
        </PageActions>
      </PageHeader>

      {pages.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No booking pages yet"
          description="Create a booking page so prospects and customers can self-schedule meetings with you. Bookings flow straight into your CRM."
          action={
            <Link href={NEW_BOOKING_HREF} className="u-btn u-btn--primary u-btn--sm">
              <span className="u-btn__label">Create a booking page</span>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {pages.map((page) => (
            <Card key={page.id} padding="none">
              <CardBody>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <CalendarClock
                      className="h-4 w-4 text-[var(--st-accent)]"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    <span className="text-sm font-semibold text-[var(--st-text)]">
                      {page.title}
                    </span>
                  </div>
                  <Badge tone={page.active ? 'success' : 'neutral'} kind="soft">
                    {page.active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--st-text-secondary)]">
                  {page.durationMinutes != null ? (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      {page.durationMinutes} min
                    </span>
                  ) : null}
                  {page.slug ? (
                    <code className="text-[var(--st-text-tertiary)]">/{page.slug}</code>
                  ) : null}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
