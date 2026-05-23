// This file is deprecated. The billing history page has been moved.
// To prevent 404 errors, we'll redirect to the new location.

import { redirect } from 'next/navigation';

export default function DeprecatedBillingHistoryPage() {
    redirect('/dashboard/user/billing/history');
}
