import * as React from 'react';

import { RouteComingSoon } from '@/components/zoruui';

export const metadata = { title: "HR & Payroll — Leave / Types · SabNode" };

export default function Page(): React.JSX.Element {
  return (
    <RouteComingSoon
      title={"HR & Payroll — Leave / Types"}
      parentHref={"/dashboard/crm/hr-payroll/leave"}
      parentLabel={"Back to Leave"}
    />
  );
}
