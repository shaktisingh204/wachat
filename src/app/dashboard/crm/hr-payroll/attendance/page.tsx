import * as React from 'react';

import { RouteComingSoon } from '@/components/zoruui';

export const metadata = { title: "HR & Payroll — Attendance · SabNode" };

export default function Page(): React.JSX.Element {
  return (
    <RouteComingSoon
      title={"HR & Payroll — Attendance"}
      parentHref={"/dashboard/crm/hr-payroll"}
      parentLabel={"Back to HR Payroll"}
    />
  );
}
