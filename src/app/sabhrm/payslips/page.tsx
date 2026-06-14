import { listPayslips } from "@/app/actions/sabhrm/payslips.actions";

import { PayslipsClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabHrmPayslipsPage() {
  const list = await listPayslips({ page: 1, pageSize: 25 });

  return (
    <PayslipsClient
      initial={list.ok ? list.data : { rows: [], total: 0, page: 1, pageSize: 25, hasMore: false }}
      loadError={list.ok ? null : list.error}
    />
  );
}
