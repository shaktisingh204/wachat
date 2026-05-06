import * as React from 'react';

import { RouteComingSoon } from '@/components/zoruui';

export const metadata = { title: "Account — Profile · SabNode" };

export default function Page(): React.JSX.Element {
  return (
    <RouteComingSoon
      title={"Account — Profile"}
      parentHref={"/dashboard/user"}
      parentLabel={"Back to User"}
    />
  );
}
