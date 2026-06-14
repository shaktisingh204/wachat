import { listSalaryStructures } from "@/app/actions/sabhrm/salary-structures.actions";

import { SalaryStructuresClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabHrmSalaryStructuresPage() {
  const list = await listSalaryStructures({ page: 1, pageSize: 25 });

  return (
    <SalaryStructuresClient
      initial={list.ok ? list.data : { rows: [], total: 0, page: 1, pageSize: 25, hasMore: false }}
      loadError={list.ok ? null : list.error}
    />
  );
}
