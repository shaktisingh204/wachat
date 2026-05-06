import * as React from 'react';

import { RouteComingSoon } from '@/components/zoruui';

export const metadata = { title: "Settings — Appearance · SabNode" };

export default function Page(): React.JSX.Element {
  return (
    <RouteComingSoon
      title={"Settings — Appearance"}
      parentHref={"/dashboard/settings"}
      parentLabel={"Back to Settings"}
    />
  );
}
