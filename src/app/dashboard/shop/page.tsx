import * as React from 'react';

import { RouteComingSoon } from '@/components/zoruui';

export const metadata = { title: "Shop · SabNode" };

export default function Page(): React.JSX.Element {
  return (
    <RouteComingSoon
      title={"Shop"}
      parentHref={"/dashboard"}
      parentLabel={"Back to dashboard"}
    />
  );
}
