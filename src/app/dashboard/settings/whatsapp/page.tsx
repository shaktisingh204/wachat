import * as React from 'react';

import { RouteComingSoon } from '@/components/zoruui';

export const metadata = { title: "Settings — Whatsapp · SabNode" };

export default function Page(): React.JSX.Element {
  return (
    <RouteComingSoon
      title={"Settings — Whatsapp"}
      parentHref={"/dashboard/settings"}
      parentLabel={"Back to Settings"}
    />
  );
}
