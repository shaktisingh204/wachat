/**
 * Sales-CRM Clients — stub redirect.
 *
 * "Clients" in Sales-CRM is an alias for Accounts. The canonical
 * surface lives at `/dashboard/crm/accounts/` (P1.1B Wave-1 close,
 * 2026-05-15) with the full EntityListShell + KPIs + filters +
 * bulk-bar + ConfirmDialog contract.
 *
 * Rather than fork the UI here, this page redirects so any operator
 * (or stale link) that lands on `/dashboard/crm/sales-crm/clients`
 * is shepherded to the canonical accounts list.
 */

import { redirect } from 'next/navigation';

export default function SalesCrmClientsRedirect() {
  redirect('/dashboard/crm/accounts');
}
