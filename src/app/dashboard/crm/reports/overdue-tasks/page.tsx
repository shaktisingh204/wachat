export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';

export default async function OverdueTasksPage(props: {
  searchParams: Promise<any>;
}) {
  const sp = await props.searchParams;
  const q = new URLSearchParams(sp as any).toString();
  redirect(`/dashboard/crm/reports/late-report?view=tasks${q ? '&' + q : ''}`);
}
