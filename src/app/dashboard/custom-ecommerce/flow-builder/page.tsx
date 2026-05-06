import * as React from 'react';

import { RouteComingSoon } from '@/components/zoruui';

export const metadata = { title: "Custom Shops — Flow Builder · SabNode" };

export default function Page(): React.JSX.Element {
  return (
    <RouteComingSoon
      title={"Custom Shops — Flow Builder"}
      parentHref={"/dashboard"}
      parentLabel={"Back to dashboard"}
    />
  );
}
