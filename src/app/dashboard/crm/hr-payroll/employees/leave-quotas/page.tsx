import * as React from 'react';

import { RouteComingSoon } from '@/components/zoruui';

export const metadata = { title: "HR & Payroll — Employees / Leave Quotas · SabNode" };

export default function Page(): React.JSX.Element {
  return (
    <RouteComingSoon
      title={"HR & Payroll — Employees / Leave Quotas"}
      parentHref={"/dashboard"}
      parentLabel={"Back to dashboard"}
    />
  );
}
