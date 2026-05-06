import * as React from 'react';

import { RouteComingSoon } from '@/components/zoruui';

export const metadata = { title: "HR & Payroll — Form 16 · SabNode" };

export default function Page(): React.JSX.Element {
  return (
    <RouteComingSoon
      title={"HR & Payroll — Form 16"}
      parentHref={"/dashboard/crm/hr-payroll"}
      parentLabel={"Back to HR Payroll"}
    />
  );
}
