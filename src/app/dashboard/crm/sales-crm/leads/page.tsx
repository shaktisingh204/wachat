import { permanentRedirect } from 'next/navigation';

/**
 * Legacy `/sales-crm/leads` route — superseded by
 * `/sales-crm/all-leads` which is the canonical leads list.
 *
 * Kept as a permanent redirect so existing bookmarks and inbound
 * links keep working.
 */
export default function LegacyLeadsRedirect(): never {
  permanentRedirect('/dashboard/crm/sales-crm/all-leads');
}
