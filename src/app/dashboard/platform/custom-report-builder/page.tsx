import { getCustomReports } from '@/app/actions/platform/custom-report-builder.actions';
import { CustomReportBuilderClient } from './client';

export const dynamic = 'force-dynamic'; // Ensures this page renders on every request to fetch fresh data if no revalidation is set

export default async function CustomReportBuilderPage() {
  const data = await getCustomReports();

  return (
    <CustomReportBuilderClient initialData={data} />
  );
}
