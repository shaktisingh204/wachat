import { listTimeLogs, getTimeLogPickerOptions } from "@/app/actions/sabhrm/time-logs.actions";

import { TimeLogsClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabHrmTimeLogsPage() {
  const [list, opts] = await Promise.all([
    listTimeLogs({ page: 1, pageSize: 25 }),
    getTimeLogPickerOptions(),
  ]);

  return (
    <TimeLogsClient
      initial={list.ok ? list.data : { rows: [], total: 0, page: 1, pageSize: 25, hasMore: false }}
      options={opts.ok ? opts.data : { employees: [] }}
      loadError={list.ok ? null : list.error}
    />
  );
}
