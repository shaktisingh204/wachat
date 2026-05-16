/**
 * Legacy `/new` route — shift creation is now handled by the inline
 * dialog on the settings-style list page. Redirect to the list so any
 * stale link still lands somewhere useful.
 */

import { redirect } from 'next/navigation';

export default function NewShiftLegacyRedirect() {
    redirect('/dashboard/hrm/payroll/shifts');
}
