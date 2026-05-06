import * as React from 'react';

import { RouteComingSoon } from '@/components/zoruui';

export const metadata = { title: "HR & Payroll — Shift Change Requests · SabNode" };

export default function Page(): React.JSX.Element {
  return (
    <RouteComingSoon
      title={"HR & Payroll — Shift Change Requests"}
      parentHref={"/dashboard/crm/hr-payroll"}
      parentLabel={"Back to HR Payroll"}
    />
  );
}
