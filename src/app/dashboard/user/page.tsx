import * as React from 'react';

import { RouteComingSoon } from '@/components/zoruui';

export const metadata = { title: "Account · SabNode" };

export default function Page(): React.JSX.Element {
  return (
    <RouteComingSoon
      title={"Account"}
      parentHref={"/dashboard"}
      parentLabel={"Back to dashboard"}
    />
  );
}
