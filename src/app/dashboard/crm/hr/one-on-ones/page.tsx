import * as React from 'react';

import { RouteComingSoon } from '@/components/zoruui';

export const metadata = { title: "HR — One On Ones · SabNode" };

export default function Page(): React.JSX.Element {
  return (
    <RouteComingSoon
      title={"HR — One On Ones"}
      parentHref={"/dashboard/crm/hr"}
      parentLabel={"Back to HR"}
    />
  );
}
