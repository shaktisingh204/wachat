import * as React from 'react';

import { RouteComingSoon } from '@/components/zoruui';

export const metadata = { title: "CRM Settings — Saved Searches · SabNode" };

export default function Page(): React.JSX.Element {
  return (
    <RouteComingSoon
      title={"CRM Settings — Saved Searches"}
      parentHref={"/dashboard/crm/settings"}
      parentLabel={"Back to Settings"}
    />
  );
}
