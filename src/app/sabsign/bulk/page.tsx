import { listTemplates } from '@/app/actions/sabsign.actions';

import { BulkClient } from './_client';

export const dynamic = 'force-dynamic';

export default async function BulkSendPage() {
  const res = await listTemplates({ limit: 200 });
  const templates = res.items.map((t) => ({
    id: t._id,
    name: t.name,
    roles: (t.recipientSlots ?? []).map((r) => r.role),
  }));
  return <BulkClient templates={templates} />;
}
