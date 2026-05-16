/**
 * Legacy edit route — shift editing now happens through the inline
 * dialog on the settings-style list page. Redirect to the list.
 */

import { redirect } from 'next/navigation';

export default async function EditShiftLegacyRedirect({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    await params;
    redirect('/dashboard/hrm/payroll/shifts');
}
