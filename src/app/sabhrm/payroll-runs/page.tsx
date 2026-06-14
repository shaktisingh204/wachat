import { listPayrollRuns } from "@/app/actions/sabhrm/payroll.actions";

import { PayrollRunsClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabHrmPayrollRunsPage() {
  const list = await listPayrollRuns({ page: 1, pageSize: 25 });

  return (
    <PayrollRunsClient
      initial={list.ok ? list.data : { rows: [], total: 0, page: 1, pageSize: 25, hasMore: false }}
      loadError={list.ok ? null : list.error}
    />
  );
}
