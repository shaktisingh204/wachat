import * as React from 'react';

import { RouteComingSoon } from '@/components/zoruui';

export const metadata = { title: "HR · SabNode" };

export default function Page(): React.JSX.Element {
  return (
    <RouteComingSoon
      title={"HR"}
      parentHref={"/dashboard/crm"}
      parentLabel={"Back to CRM"}
    />
  );
}
