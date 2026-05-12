/**
 * Edit holiday — `/dashboard/crm/hr-payroll/holidays/[id]/edit`.
 *
 * Hydrates the existing holiday and passes it to the shared
 * `<HolidayForm>` (re-used from the Create flow). The form submits a
 * PATCH because `_id` is rendered as a hidden input.
 */

import { notFound } from 'next/navigation';
import { CalendarDays } from 'lucide-react';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
import { HolidayForm } from '../../_components/holiday-form';
import { getHoliday } from '@/app/actions/crm/holidays.actions';

export const dynamic = 'force-dynamic';

export default async function EditHolidayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { holiday } = await getHoliday(id);

  if (!holiday) notFound();

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={`Edit ${holiday.name}`}
        subtitle="Update holiday details."
        icon={CalendarDays}
      />
      <HolidayForm initial={holiday} />
    </div>
  );
}
