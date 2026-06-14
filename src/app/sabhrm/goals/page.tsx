import { listGoals, getGoalPickerOptions } from "@/app/actions/sabhrm/goals.actions";

import { GoalsClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabHrmGoalsPage() {
  const [list, opts] = await Promise.all([
    listGoals({ page: 1, pageSize: 25 }),
    getGoalPickerOptions(),
  ]);

  return (
    <GoalsClient
      initial={list.ok ? list.data : { rows: [], total: 0, page: 1, pageSize: 25, hasMore: false }}
      options={opts.ok ? opts.data : { employees: [] }}
      loadError={list.ok ? null : list.error}
    />
  );
}
