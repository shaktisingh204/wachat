import { listAttendance, getAttendancePickerOptions } from "@/app/actions/sabhrm/attendance.actions";

import { AttendanceClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabHrmAttendancePage() {
  const [list, opts] = await Promise.all([
    listAttendance({ page: 1, pageSize: 50 }),
    getAttendancePickerOptions(),
  ]);

  return (
    <AttendanceClient
      initial={list.ok ? list.data : { rows: [], total: 0, page: 1, pageSize: 50, hasMore: false }}
      options={opts.ok ? opts.data : { employees: [] }}
      loadError={list.ok ? null : list.error}
    />
  );
}
