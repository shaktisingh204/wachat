/**
 * Legacy redirect. The Analytics Workspace was consolidated into SabBI
 * (`/dashboard/sabbi`) in the BI program's P0. This stub preserves any old
 * bookmarks / links by forwarding to the workbooks hub under SabBI.
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function AnalyticsWorkspaceRedirect() {
  redirect('/dashboard/sabbi/workbooks');
}
