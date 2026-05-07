import Link from 'next/link';
import { ObjectId } from 'mongodb';
import { CalendarClock, Plus } from 'lucide-react';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

type AnyBooking = {
  _id?: { toString(): string } | string;
  resourceName?: string;
  resourceId?: { toString(): string } | string;
  customerName?: string;
  customerId?: { toString(): string } | string;
  slotStart?: string | Date;
  slotEnd?: string | Date;
  status?: string;
  paymentStatus?: string;
  createdAt?: string | Date;
};

function formatDateTime(value: string | Date | undefined | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function getStatusVariant(
  status?: string,
): 'success' | 'warning' | 'danger' | 'ghost' {
  const s = (status || '').toLowerCase();
  if (s === 'active' || s === 'completed' || s === 'confirmed') return 'success';
  if (s === 'paused' || s === 'draft') return 'ghost';
  if (s === 'cancelled' || s === 'voided' || s === 'past_due' || s === 'no_show')
    return 'danger';
  return 'warning';
}

function getPaymentVariant(
  status?: string,
): 'success' | 'warning' | 'danger' | 'ghost' {
  const s = (status || '').toLowerCase();
  if (s === 'paid' || s === 'completed') return 'success';
  if (s === 'pending' || s === 'partial') return 'warning';
  if (s === 'failed' || s === 'refunded' || s === 'cancelled') return 'danger';
  return 'ghost';
}

function idToString(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (typeof (v as any).toString === 'function') return (v as any).toString();
  return null;
}

export default async function BookingsPage() {
  let bookings: AnyBooking[] = [];
  let loadError = false;

  const session = await getSession();
  if (session?.user?._id) {
    try {
      const { db } = await connectToDatabase();
      const userObjectId = new ObjectId(session.user._id);
      const docs = await db
        .collection('crm_bookings')
        .find({ userId: userObjectId } as any)
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();
      bookings = JSON.parse(JSON.stringify(docs)) as AnyBooking[];
    } catch (e) {
      console.error('Failed to load CRM bookings:', e);
      loadError = true;
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Bookings & Appointments"
        subtitle="Let customers book time on staff calendars and manage appointments."
        icon={CalendarClock}
        actions={
          <Link href="/dashboard/crm/bookings/new">
            <ZoruButton variant="outline">
              <Plus className="h-4 w-4" strokeWidth={1.75} />
              New booking
            </ZoruButton>
          </Link>
        }
      />

      <ZoruCard className="p-6">
        <div className="mb-4">
          <h2 className="text-[16px] text-zoru-ink">All bookings</h2>
          <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
            Customer appointments and resource reservations.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Resource</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Customer</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Slot start</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Slot end</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Payment</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {loadError ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={6}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    Could not load bookings. Please try again.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : bookings.length > 0 ? (
                bookings.map((b, idx) => {
                  const id =
                    typeof b._id === 'string'
                      ? b._id
                      : b._id?.toString?.() ?? String(idx);
                  const resource =
                    (b as any).resourceName ||
                    idToString((b as any).resourceId) ||
                    '—';
                  const customer =
                    (b as any).customerName ||
                    idToString((b as any).customerId) ||
                    '—';
                  return (
                    <ZoruTableRow key={id} className="border-zoru-line">
                      <ZoruTableCell className="text-zoru-ink">{resource}</ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">{customer}</ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatDateTime((b as any).slotStart)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatDateTime((b as any).slotEnd)}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <ZoruBadge variant={getStatusVariant(b.status)}>
                          {b.status || 'draft'}
                        </ZoruBadge>
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <ZoruBadge variant={getPaymentVariant((b as any).paymentStatus)}>
                          {(b as any).paymentStatus || 'unpaid'}
                        </ZoruBadge>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })
              ) : (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={6}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    No bookings yet. Open up a booking page to start accepting
                    appointments.
                  </ZoruTableCell>
                </ZoruTableRow>
              )}
            </ZoruTableBody>
          </ZoruTable>
        </div>
      </ZoruCard>
    </div>
  );
}
