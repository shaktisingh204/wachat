import { listHolidays } from "@/app/actions/sabhrm/holidays.actions";

import { HolidaysClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabHrmHolidaysPage() {
  const list = await listHolidays({ page: 1, pageSize: 100 });

  return (
    <HolidaysClient
      initial={list.ok ? list.data : { rows: [], total: 0, page: 1, pageSize: 100, hasMore: false }}
      loadError={list.ok ? null : list.error}
    />
  );
}
