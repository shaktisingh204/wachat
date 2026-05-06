import * as React from 'react';

import { RouteComingSoon } from '@/components/zoruui';

export const metadata = { title: "HR & Payroll — Employees / Visa Details · SabNode" };

export default function Page(): React.JSX.Element {
  return (
    <RouteComingSoon
      title={"HR & Payroll — Employees / Visa Details"}
      parentHref={"/dashboard"}
      parentLabel={"Back to dashboard"}
    />
  );
}
