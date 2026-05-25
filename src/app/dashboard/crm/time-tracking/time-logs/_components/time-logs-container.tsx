import { getTimeLogs } from '@/app/actions/worksuite/time.actions';
import { TimeLogsInnerClient } from './time-logs-inner-client';

interface TimeLogsContainerProps {
  filters: {
    employeeId: string;
    projectId: string;
    from: string;
    to: string;
  };
}

export async function TimeLogsContainer({ filters }: TimeLogsContainerProps) {
  const rows = await getTimeLogs({
    project_id: filters.projectId || undefined,
    user_id: filters.employeeId || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
  });

  return (
    <TimeLogsInnerClient
      rows={rows}
      initialFilters={filters}
    />
  );
}
