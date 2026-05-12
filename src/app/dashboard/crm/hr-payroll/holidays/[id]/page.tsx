/**
 * Holiday detail — `/dashboard/crm/hr-payroll/holidays/[id]`.
 *
 * Server component: hydrates the holiday via the Rust client, resolves
 * the optional country/state via `<EntityPickerChip>`, and renders the
 * full document. Delete lives on the list page; this page exposes only
 * an Edit action.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarDays, Pencil, ArrowLeft } from 'lucide-react';

import { ZoruBadge, ZoruButton, ZoruCard } from '@/components/zoruui';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { getHoliday } from '@/app/actions/crm/holidays.actions';

export const dynamic = 'force-dynamic';

function fmtDate(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: '2-digit',
      });
}

function fmtDateShort(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function looksLikeObjectId(v?: string): boolean {
  return !!v && /^[0-9a-fA-F]{24}$/.test(v);
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
        {label}
      </div>
      <div className="mt-1 text-[13px] text-zoru-ink">{children}</div>
    </div>
  );
}

export default async function HolidayDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { holiday, error } = await getHoliday(id);

  if (!holiday) {
    if (error) {
      return (
        <div className="flex w-full flex-col gap-4 p-6">
          <p className="text-[14px] text-zoru-ink">
            Couldn&apos;t load this holiday — {error}
          </p>
          <ZoruButton variant="outline" asChild>
            <Link href="/dashboard/crm/hr-payroll/holidays">
              <ArrowLeft className="h-4 w-4" /> Back to Holidays
            </Link>
          </ZoruButton>
        </div>
      );
    }
    notFound();
  }

  const locationOids = (holiday.applicableLocations ?? []).filter(
    looksLikeObjectId,
  );
  const countryId = locationOids[0] ?? null;
  const stateId = locationOids[1] ?? null;
  const tagLocations = (holiday.applicableLocations ?? []).filter(
    (l) => !looksLikeObjectId(l),
  );

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={holiday.name}
        subtitle={`${fmtDate(holiday.date)}${
          holiday.holidayType ? ` · ${holiday.holidayType}` : ''
        }`}
        icon={CalendarDays}
        actions={
          <>
            <ZoruButton variant="outline" asChild>
              <Link href="/dashboard/crm/hr-payroll/holidays">
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
            </ZoruButton>
            <ZoruButton asChild>
              <Link
                href={`/dashboard/crm/hr-payroll/holidays/${id}/edit`}
              >
                <Pencil className="h-4 w-4" /> Edit
              </Link>
            </ZoruButton>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <ZoruCard className="p-6 lg:col-span-2">
          <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Calendar
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Name">{holiday.name}</Field>
            <Field label="Date">{fmtDate(holiday.date)}</Field>
            <Field label="Type">
              {holiday.holidayType ? (
                <ZoruBadge variant="outline" className="capitalize">
                  {holiday.holidayType}
                </ZoruBadge>
              ) : (
                '—'
              )}
            </Field>
            <Field label="Recurring">
              {holiday.recurring ? (
                <ZoruBadge variant="outline">Yearly</ZoruBadge>
              ) : (
                'One-off'
              )}
            </Field>
          </div>

          <h3 className="mb-4 mt-8 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Description
          </h3>
          <div className="whitespace-pre-wrap text-[13px] text-zoru-ink">
            {holiday.notes || '—'}
          </div>
        </ZoruCard>

        <ZoruCard className="p-6">
          <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Applicable region
          </h3>
          <div className="flex flex-col gap-4">
            <Field label="Country">
              {countryId ? (
                <EntityPickerChip entity="country" id={countryId} />
              ) : (
                '—'
              )}
            </Field>
            <Field label="State / Region">
              {stateId ? (
                <EntityPickerChip entity="state" id={stateId} />
              ) : (
                '—'
              )}
            </Field>
            {tagLocations.length > 0 ? (
              <Field label="Other tags">
                <div className="flex flex-wrap gap-1">
                  {tagLocations.map((t) => (
                    <ZoruBadge key={t} variant="outline">
                      {t}
                    </ZoruBadge>
                  ))}
                </div>
              </Field>
            ) : null}
          </div>
        </ZoruCard>
      </div>

      <div className="text-[11px] text-zoru-ink-muted">
        Created {fmtDateShort(holiday.createdAt || holiday.audit?.createdAt)} ·
        Updated{' '}
        {fmtDateShort(holiday.updatedAt || holiday.audit?.updatedAt)}
      </div>
    </div>
  );
}
