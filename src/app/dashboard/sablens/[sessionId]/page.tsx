import { notFound } from 'next/navigation';

import {
  getSablensSession,
  listSablensActionLog,
  listSablensAnnotations,
  listSablensChat,
} from '@/app/actions/sablens.actions';

import { TechnicianConsole } from './_components/technician-console';

export const dynamic = 'force-dynamic';

type Params = Promise<{ sessionId: string }>;

export default async function SablensSessionPage({
  params,
}: {
  params: Params;
}) {
  const { sessionId } = await params;
  const sessionRes = await getSablensSession(sessionId);
  if (!sessionRes.ok) notFound();

  const [annotations, chat, log] = await Promise.all([
    listSablensAnnotations({ sessionId, limit: 200 }),
    listSablensChat({ sessionId, limit: 200 }),
    listSablensActionLog({ sessionId, limit: 200 }),
  ]);

  return (
    <TechnicianConsole
      session={sessionRes.data}
      initialAnnotations={annotations.ok ? annotations.data.items : []}
      initialChat={chat.ok ? chat.data.items : []}
      initialActionLog={log.ok ? log.data.items : []}
    />
  );
}
