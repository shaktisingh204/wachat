import * as React from 'react';

import { RouteComingSoon } from '@/components/zoruui';

export const metadata = { title: "HR & Payroll — Leave / Balance · SabNode" };

export default function Page(): React.JSX.Element {
  return (
    <RouteComingSoon
      title={"HR & Payroll — Leave / Balance"}
      parentHref={"/dashboard/crm/hr-payroll/leave"}
      parentLabel={"Back to Leave"}
    />
  );
}
