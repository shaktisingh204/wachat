import * as React from 'react';
import type { Metadata } from 'next';

import { GroupManagerClient } from './_components/group-manager-client';

export const metadata: Metadata = { title: 'Group Manager — SabWa' };

export default async function GroupManagerPage({
  params,
}: {
  params: Promise<{ jid: string }>;
}) {
  const { jid } = await params;
  return <GroupManagerClient groupJid={decodeURIComponent(jid)} />;
}
