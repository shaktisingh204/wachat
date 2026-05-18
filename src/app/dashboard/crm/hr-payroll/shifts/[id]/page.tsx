/**
 * Shift detail — there is no standalone detail page; editing happens
 * via the inline dialog on the list page. Deep links that land here
 * fall back to the list.
 */

import { redirect } from 'next/navigation';

export default async function ShiftDetailLegacyRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await params;
  redirect('/dashboard/crm/hr-payroll/shifts');
}
