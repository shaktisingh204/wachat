import * as React from 'react';

import { RouteComingSoon } from '@/components/zoruui';

export const metadata = { title: "Sales CRM — Agents · SabNode" };

export default function Page(): React.JSX.Element {
  return (
    <RouteComingSoon
      title={"Sales CRM — Agents"}
      parentHref={"/dashboard/crm/sales-crm"}
      parentLabel={"Back to Sales CRM"}
    />
  );
}
