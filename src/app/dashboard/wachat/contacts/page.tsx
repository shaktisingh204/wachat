import * as React from 'react';

import { RouteComingSoon } from '@/components/zoruui';

export const metadata = { title: "WhatsApp — Contacts · SabNode" };

export default function Page(): React.JSX.Element {
  return (
    <RouteComingSoon
      title={"WhatsApp — Contacts"}
      parentHref={"/dashboard/wachat"}
      parentLabel={"Back to Wachat"}
    />
  );
}
