import * as React from 'react';

import { RouteComingSoon } from '@/components/zoruui';

export const metadata = { title: "CRM — Leads · SabNode" };

export default function Page(): React.JSX.Element {
  return (
    <RouteComingSoon
      title={"CRM — Leads"}
      parentHref={"/dashboard/crm"}
      parentLabel={"Back to CRM"}
    />
  );
}
