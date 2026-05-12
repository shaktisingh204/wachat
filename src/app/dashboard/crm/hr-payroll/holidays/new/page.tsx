/**
 * Create holiday — `/dashboard/crm/hr-payroll/holidays/new`.
 *
 * Server component shell — hands off to the shared `<HolidayForm>`
 * (also used by Edit). Holidays are not eligible for custom fields,
 * so no custom-field hydration happens here.
 */

import { CalendarDays } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { HolidayForm } from '../_components/holiday-form';

export const dynamic = 'force-dynamic';

export default function NewHolidayPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="New holiday"
        subtitle="Add a holiday to the company calendar."
        icon={CalendarDays}
      />
      <HolidayForm />
    </div>
  );
}
