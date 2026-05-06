import * as React from 'react';

import { RouteComingSoon } from '@/components/zoruui';

export const metadata = { title: "HR — Timesheets · SabNode" };

export default function Page(): React.JSX.Element {
  return (
    <RouteComingSoon
      title={"HR — Timesheets"}
      parentHref={"/dashboard/crm/hr"}
      parentLabel={"Back to HR"}
    />
  );
}
