/**
 * Booking detail page.
 *
 * Server component sibling of the bookings list page. Renders the
 * resource + customer header, the slot window in big text, status and
 * payment badges, and a small reminders list when present.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ObjectId } from 'mongodb';
import { ArrowLeft, CalendarClock } from 'lucide-react';

import { ZoruBadge, ZoruButton, ZoruCard } from '@/components/zoruui';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { getBookingById } from '@/app/actions/crm-bookings.actions';
import { getSession } from '@/app/actions/user.actions';

function fmtDateTime(v: unknown): string {
    if (!v) return '—';
    const d = new Date(v as any);
    return isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function statusVariant(status?: string): 'ghost' | 'success' | 'warning' | 'danger' {
    const s = (status || '').toLowerCase();
    if (s === 'active' || s === 'completed' || s === 'confirmed') return 'success';
    if (s === 'paused' || s === 'draft') return 'ghost';
    if (s === 'cancelled' || s === 'voided' || s === 'no_show') return 'danger';
    return 'warning';
}

function paymentVariant(status?: string): 'ghost' | 'success' | 'warning' | 'danger' {
    const s = (status || '').toLowerCase();
    if (s === 'paid' || s === 'completed') return 'success';
    if (s === 'pending' || s === 'partial') return 'warning';
    if (s === 'failed' || s === 'refunded' || s === 'cancelled') return 'danger';
    return 'ghost';
}

function idToString(v: unknown): string {
    if (!v) return '';
    if (typeof v === 'string') return v;
    if (typeof (v as any).toString === 'function') return (v as any).toString();
    return '';
}

interface Reminder {
    channel?: string;
    type?: string;
    offsetMinutes?: number;
    sentAt?: string | Date;
    note?: string;
}

export default async function BookingDetailPage({
    params,
}: {
    params: Promise<{ bookingId: string }>;
}) {
    const { bookingId } = await params;

    const session = await getSession();
    if (!session?.user) notFound();
    if (!ObjectId.isValid(bookingId)) notFound();

    const booking = await getBookingById(bookingId);
    if (!booking) {
        notFound();
    }

    const resourceName =
        ((booking as any).resourceName as string) ||
        idToString((booking as any).resourceId) ||
        '—';
    const customerName =
        ((booking as any).customerName as string) ||
        idToString((booking as any).customerId) ||
        '—';
    const slotStart = (booking as any).slotStart;
    const slotEnd = (booking as any).slotEnd;
    const status = ((booking as any).status as string) || 'draft';
    const paymentStatus = ((booking as any).paymentStatus as string) || 'unpaid';
    const recurrence = ((booking as any).recurrence as string) || '';
    const capacity = (booking as any).capacity as number | undefined;
    const notes = ((booking as any).notes as string) || '';
    const reminders: Reminder[] = Array.isArray((booking as any).reminders)
        ? ((booking as any).reminders as Reminder[])
        : [];

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title={resourceName}
                subtitle={`Booking for ${customerName}`}
                icon={CalendarClock}
                actions={
                    <Link href="/dashboard/crm/bookings">
                        <ZoruButton variant="outline">
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </ZoruButton>
                    </Link>
                }
            />

            <ZoruCard className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 className="text-[16px] text-zoru-ink">{resourceName}</h2>
                        <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                            Customer: {customerName}
                            {recurrence ? ` • Recurrence: ${recurrence}` : ''}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <ZoruBadge variant={statusVariant(status)}>{status}</ZoruBadge>
                        <ZoruBadge variant={paymentVariant(paymentStatus)}>
                            {paymentStatus}
                        </ZoruBadge>
                    </div>
                </div>

                <div className="mt-6 rounded-md border border-zoru-line bg-zoru-surface-2 p-4">
                    <div className="text-[11.5px] uppercase tracking-wide text-zoru-ink-muted">
                        Slot window
                    </div>
                    <div className="mt-1 text-[18px] text-zoru-ink">
                        {fmtDateTime(slotStart)}
                        <span className="text-zoru-ink-muted"> → </span>
                        {fmtDateTime(slotEnd)}
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 text-[13px] sm:grid-cols-2">
                    <div>
                        <div className="text-zoru-ink-muted">Resource</div>
                        <div className="text-zoru-ink">{resourceName}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Customer</div>
                        <div className="text-zoru-ink">{customerName}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Recurrence</div>
                        <div className="text-zoru-ink">{recurrence || '—'}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Capacity</div>
                        <div className="text-zoru-ink">
                            {typeof capacity === 'number' ? capacity : '—'}
                        </div>
                    </div>
                </div>

                {notes && (
                    <div className="mt-4 rounded-md border border-zoru-line bg-zoru-surface-2 p-3 text-[13px] text-zoru-ink">
                        {notes}
                    </div>
                )}

                {reminders.length > 0 && (
                    <div className="mt-6">
                        <div className="mb-2 text-[12.5px] text-zoru-ink-muted">Reminders</div>
                        <ul className="space-y-2 text-[13px] text-zoru-ink">
                            {reminders.map((r, i) => {
                                const label = r.channel || r.type || `Reminder ${i + 1}`;
                                return (
                                    <li
                                        key={`reminder-${i}`}
                                        className="rounded-md border border-zoru-line bg-zoru-surface-2 px-2.5 py-1.5"
                                    >
                                        <span className="font-medium text-zoru-ink">{label}</span>
                                        {typeof r.offsetMinutes === 'number' && (
                                            <span className="text-zoru-ink-muted">
                                                {' '}
                                                • {r.offsetMinutes}m before
                                            </span>
                                        )}
                                        {r.sentAt && (
                                            <span className="text-zoru-ink-muted">
                                                {' '}
                                                • sent {fmtDateTime(r.sentAt)}
                                            </span>
                                        )}
                                        {r.note && (
                                            <div className="mt-0.5 text-[11.5px] text-zoru-ink-muted">
                                                {r.note}
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}
            </ZoruCard>
        </div>
    );
}
