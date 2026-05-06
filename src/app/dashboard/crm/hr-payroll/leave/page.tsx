import * as React from 'react';

import { RouteComingSoon } from '@/components/zoruui';

export const metadata = { title: "HR & Payroll — Leave · SabNode" };

export default function Page(): React.JSX.Element {
  return (
    <RouteComingSoon
      title={"HR & Payroll — Leave"}
      parentHref={"/dashboard/crm/hr-payroll"}
      parentLabel={"Back to HR Payroll"}
    />
  );
}
