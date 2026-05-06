import * as React from 'react';

import { RouteComingSoon } from '@/components/zoruui';

export const metadata = { title: "HR & Payroll — Designations / Hierarchy · SabNode" };

export default function Page(): React.JSX.Element {
  return (
    <RouteComingSoon
      title={"HR & Payroll — Designations / Hierarchy"}
      parentHref={"/dashboard"}
      parentLabel={"Back to dashboard"}
    />
  );
}
