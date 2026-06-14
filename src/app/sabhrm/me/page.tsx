import { getMyHrmSpace } from "@/app/actions/sabhrm/me.actions";

import { MyHrmSpaceClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabHrmMyPage() {
  const res = await getMyHrmSpace();
  const data = res.ok
    ? res.data
    : { employee: null, leaveRequests: [], attendance: [], payslips: [] };

  return <MyHrmSpaceClient data={data} />;
}
