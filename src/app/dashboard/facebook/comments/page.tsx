import * as React from 'react';

import { RouteComingSoon } from '@/components/zoruui';

export const metadata = { title: "Meta Suite — Comments · SabNode" };

export default function Page(): React.JSX.Element {
  return (
    <RouteComingSoon
      title={"Meta Suite — Comments"}
      parentHref={"/dashboard/facebook"}
      parentLabel={"Back to Facebook"}
    />
  );
}
