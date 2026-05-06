import * as React from 'react';

import { RouteComingSoon } from '@/components/zoruui';

export const metadata = { title: "WhatsApp · SabNode" };

export default function Page(): React.JSX.Element {
  return (
    <RouteComingSoon
      title={"WhatsApp"}
      parentHref={"/dashboard"}
      parentLabel={"Back to dashboard"}
    />
  );
}
