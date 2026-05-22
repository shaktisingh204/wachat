/**
 * Legacy shift detail route — shift management now happens through the
 * inline dialog on the settings-style list page (matching the sibling
 * `/new` and `/edit` routes, which are both legacy redirects). Redirect
 * to the list so any stale link still lands somewhere useful.
 */

import { redirect } from 'next/navigation';

export default async function ShiftDetailLegacyRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await params;
  redirect('/dashboard/hrm/payroll/shifts');
}
