import * as React from 'react';

import { RouteComingSoon } from '@/components/zoruui';

export const metadata = { title: "Meta Suite — Catalog · SabNode" };

export default function Page(): React.JSX.Element {
  return (
    <RouteComingSoon
      title={"Meta Suite — Catalog"}
      parentHref={"/dashboard/facebook"}
      parentLabel={"Back to Facebook"}
    />
  );
}
