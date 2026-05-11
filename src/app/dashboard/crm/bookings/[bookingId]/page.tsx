/**
 * Booking detail page — server component.
 *
 * Guards: session required + booking must belong to userId.
 * On failure both redirect to /dashboard/crm/bookings.
 *
 * Displays a structured "Booking Details" ZoruCard (2-column grid) with
 * all booking fields, computed duration, ZoruBadge for status / payment,
 * and full-width notes when present.
 *
 * Header actions: Back (Link), Edit (disabled placeholder), Cancel (disabled placeholder).
 */

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarClock, ArrowLeft, Pencil, XCircle } from 'lucide-react';

import { ZoruBadge, ZoruButton, ZoruCard } from '@/components/zoruui';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { getBookingById } from '@/app/actions/crm-bookings.actions';
import { getSession } from '@/app/actions/user.actions';

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtDateTime(v: unknown): string {
    if (!v) return '—';
    const d = new Date(v as string | number | Date);
    return isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function computeDurationMinutes(start: unknown, end: unknown): string {
    if (!start || !end) return '—';
    const s = new Date(start as string | number | Date);
    const e = new Date(end as string | number | Date);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return '—';
    const diffMs = e.getTime() - s.getTime();
    if (diffMs <= 0) return '—';
    const mins = Math.round(diffMs / 60_000);
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

function statusVariant(status?: string): 'ghost' | 'success' | 'warning' | 'danger' {
    const s = (status ?? '').toLowerCase();
    if (s === 'confirmed' || s === 'completed' || s === 'active') return 'success';
    if (s === 'cancelled' || s === 'no_show' || s === 'voided') return 'danger';
    if (s === 'draft' || s === 'pending') return 'warning';
    return 'ghost';
}

function paymentVariant(status?: string): 'ghost' | 'success' | 'warning' | 'danger' {
    const s = (status ?? '').toLowerCase();
    if (s === 'paid' || s === 'completed') return 'success';
    if (s === 'pending' || s === 'partial') return 'warning';
    if (s === 'failed' || s === 'refunded' || s === 'cancelled') return 'danger';
    return 'ghost';
}

// ─── detail row helpers ──────────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div>
            <div className="text-[11.5px] text-zoru-ink-muted">{label}</div>
            <div className="mt-0.5 text-[13px] text-zoru-ink">{value || '—'}</div>
        </div>
    );
}

// ─── page ────────────────────────────────────────────────────────────────────

export default async function BookingDetailPage({
    params,
}: {
    params: Promise<{ bookingId: string }>;
}) {
    const { bookingId } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/dashboard/crm/bookings');

    const booking = await getBookingById(bookingId);
    if (!booking) redirect('/dashboard/crm/bookings');

    // ── field extraction ──────────────────────────────────────────────────
    const b = booking as Record<string, unknown>;

    const resourceName = (b.resourceName as string) || 'Booking';
    const serviceName = (b.serviceName as string) || '';
    const customerName = (b.customerName as string) || '';
    const customerEmail = (b.customerEmail as string) || '';
    const customerPhone = (b.customerPhone as string) || '';
    const slotStart = b.slotStart;
    const slotEnd = b.slotEnd;
    const duration = computeDurationMinutes(slotStart, slotEnd);
    const status = (b.status as string) || 'draft';
    const paymentStatus = (b.paymentStatus as string) || 'pending';
    const notes = (b.notes as string) || '';

    return (
        <div className="flex w-full flex-col gap-6">
            {/* ── header ─────────────────────────────────────────────────── */}
            <CrmPageHeader
                title={resourceName}
                subtitle="Booking detail"
                icon={CalendarClock}
                actions={
                    <div className="flex flex-wrap items-center gap-2">
                        <Link href="/dashboard/crm/bookings">
                            <ZoruButton variant="outline">
                                <ArrowLeft className="h-4 w-4" />
                                Back
                            </ZoruButton>
                        </Link>

                        <ZoruButton variant="outline" disabled>
                            <Pencil className="h-4 w-4" />
                            Edit
                        </ZoruButton>

                        <ZoruButton variant="outline" disabled>
                            <XCircle className="h-4 w-4" />
                            Cancel
                        </ZoruButton>
                    </div>
                }
            />

            {/* ── booking details card ────────────────────────────────────── */}
            <ZoruCard className="p-6">
                <h2 className="mb-4 text-[14px] font-medium text-zoru-ink">Booking Details</h2>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <DetailRow label="Resource / Staff" value={resourceName} />
                    <DetailRow label="Service" value={serviceName} />
                    <DetailRow label="Customer" value={customerName} />
                    <DetailRow label="Customer Email" value={customerEmail} />
                    <DetailRow label="Customer Phone" value={customerPhone} />
                    <DetailRow label="Slot Start" value={fmtDateTime(slotStart)} />
                    <DetailRow label="Slot End" value={fmtDateTime(slotEnd)} />
                    <DetailRow label="Duration" value={duration} />

                    <div>
                        <div className="text-[11.5px] text-zoru-ink-muted">Status</div>
                        <div className="mt-1">
                            <ZoruBadge variant={statusVariant(status)}>{status}</ZoruBadge>
                        </div>
                    </div>

                    <div>
                        <div className="text-[11.5px] text-zoru-ink-muted">Payment Status</div>
                        <div className="mt-1">
                            <ZoruBadge variant={paymentVariant(paymentStatus)}>
                                {paymentStatus}
                            </ZoruBadge>
                        </div>
                    </div>

                    {notes && (
                        <div className="sm:col-span-2">
                            <div className="text-[11.5px] text-zoru-ink-muted">Notes</div>
                            <div className="mt-1 rounded-md border border-zoru-line bg-zoru-surface-2 p-3 text-[13px] text-zoru-ink">
                                {notes}
                            </div>
                        </div>
                    )}
                </div>
            </ZoruCard>
        </div>
    );
}
