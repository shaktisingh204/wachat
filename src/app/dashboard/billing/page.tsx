// This file is deprecated. The billing page has been moved.
// To prevent 404 errors, we'll redirect to the new location.

import { permanentRedirect } from 'next/navigation';

export default function DeprecatedBillingPage() {
    permanentRedirect('/dashboard/user/billing');
}
