import * as React from 'react';
import type { Metadata } from 'next';

import { GroupsPageClient } from './_components/groups-page-client';

export const metadata: Metadata = { title: 'Groups — SabWa' };

export default function GroupsPage() {
  return <GroupsPageClient />;
}
