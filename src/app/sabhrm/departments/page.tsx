import { listDepartments, getDepartmentPickerOptions } from "@/app/actions/sabhrm/departments.actions";

import { DepartmentsClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabHrmDepartmentsPage() {
  const [list, opts] = await Promise.all([
    listDepartments({ page: 1, pageSize: 25 }),
    getDepartmentPickerOptions(),
  ]);

  return (
    <DepartmentsClient
      initial={list.ok ? list.data : { rows: [], total: 0, page: 1, pageSize: 25, hasMore: false }}
      options={opts.ok ? opts.data : { heads: [] }}
      loadError={list.ok ? null : list.error}
    />
  );
}
