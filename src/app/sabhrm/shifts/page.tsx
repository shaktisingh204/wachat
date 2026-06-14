import { listShifts } from "@/app/actions/sabhrm/shifts.actions";

import { ShiftsClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabHrmShiftsPage() {
  const list = await listShifts({ page: 1, pageSize: 50 });

  return (
    <ShiftsClient
      initial={list.ok ? list.data : { rows: [], total: 0, page: 1, pageSize: 50, hasMore: false }}
      loadError={list.ok ? null : list.error}
    />
  );
}
