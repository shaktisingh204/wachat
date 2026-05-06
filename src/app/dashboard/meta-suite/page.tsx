import * as React from 'react';

import { RouteComingSoon } from '@/components/zoruui';

export const metadata = { title: "Meta Suite · SabNode" };

export default function Page(): React.JSX.Element {
  return (
    <RouteComingSoon
      title={"Meta Suite"}
      parentHref={"/dashboard"}
      parentLabel={"Back to dashboard"}
    />
  );
}
