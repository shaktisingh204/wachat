import * as React from 'react';

import { RouteComingSoon } from '@/components/zoruui';

export const metadata = { title: "HR — Announcements · SabNode" };

export default function Page(): React.JSX.Element {
  return (
    <RouteComingSoon
      title={"HR — Announcements"}
      parentHref={"/dashboard/crm/hr"}
      parentLabel={"Back to HR"}
    />
  );
}
