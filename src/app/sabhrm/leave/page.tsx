import {
  getLeavePickerOptions,
  listLeaveRequests,
  listLeaveTypes,
} from "@/app/actions/sabhrm/leave.actions";

import { LeaveClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabHrmLeavePage() {
  const [requests, typesRes, opts] = await Promise.all([
    listLeaveRequests({ page: 1, pageSize: 50 }),
    listLeaveTypes(),
    getLeavePickerOptions(),
  ]);

  const loadError = !requests.ok
    ? requests.error
    : !typesRes.ok
      ? typesRes.error
      : null;

  return (
    <LeaveClient
      initialRequests={
        requests.ok ? requests.data : { rows: [], total: 0, page: 1, pageSize: 50, hasMore: false }
      }
      initialTypes={typesRes.ok ? typesRes.data : []}
      options={opts.ok ? opts.data : { employees: [], leaveTypes: [] }}
      loadError={loadError}
    />
  );
}
