export const dynamic = "force-dynamic";
import { getActivityLogs } from '@/app/actions/platform/activity-logs.actions';
import { ActivityLogsClient } from './activity-logs-client';

export default async function ActivityLogsPage(props: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  
  const page = Number(searchParams?.page) || 1;
  const pageSize = 20;
  
  const query = (searchParams?.query as string) || '';
  const userId = (searchParams?.userId as string) || '';
  const startDate = (searchParams?.startDate as string) || undefined;
  const endDate = (searchParams?.endDate as string) || undefined;

  const { data, total } = await getActivityLogs({
    page,
    pageSize,
    query,
    userId,
    startDate,
    endDate
  });

  return (
    <ActivityLogsClient
      initialData={data}
      total={total}
      page={page}
      pageSize={pageSize}
    />
  );
}
