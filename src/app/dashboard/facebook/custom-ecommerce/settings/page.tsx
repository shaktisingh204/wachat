import * as React from 'react';

import { RouteComingSoon } from '@/components/zoruui';

export const metadata = { title: "Custom Shops — Settings · SabNode" };

export default function Page(): React.JSX.Element {
  return (
    <RouteComingSoon
      title={"Custom Shops — Settings"}
      parentHref={"/dashboard/facebook/custom-ecommerce"}
      parentLabel={"Back to Custom Ecommerce"}
    />
  );
}
