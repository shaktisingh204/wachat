import { listEmployees, getEmployeePickerOptions } from "@/app/actions/sabhrm/employees.actions";

import { EmployeesClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabHrmEmployeesPage() {
  const [list, opts] = await Promise.all([
    listEmployees({ page: 1, pageSize: 25 }),
    getEmployeePickerOptions(),
  ]);

  return (
    <EmployeesClient
      initial={list.ok ? list.data : { rows: [], total: 0, page: 1, pageSize: 25, hasMore: false }}
      options={opts.ok ? opts.data : { departments: [], designations: [], managers: [], salaryStructures: [] }}
      loadError={list.ok ? null : list.error}
    />
  );
}
