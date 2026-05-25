import { Suspense } from 'react';
import { getOrgChartNodes } from '@/app/actions/hrm-advanced/org-chart';
import { OrgChartClient } from './_components/OrgChartClient';
import Loading from './loading';

export const dynamic = 'force-dynamic';

export default async function OrgChartPage() {
  return (
    <Suspense fallback={<Loading />}>
      <OrgChartWrapper />
    </Suspense>
  );
}

async function OrgChartWrapper() {
  const data = await getOrgChartNodes();
  return <OrgChartClient initialData={data || []} />;
}
