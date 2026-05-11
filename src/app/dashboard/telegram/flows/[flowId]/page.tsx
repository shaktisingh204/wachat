/**
 * /dashboard/telegram/flows/[flowId] — Telegram flow editor route.
 *
 * Thin async server wrapper that resolves the dynamic param (Next.js 16 makes
 * `params` a `Promise`) and hands off to the client-side editor shell.
 */
import { FlowEditorShell } from '@/components/telegram-flows/FlowEditorShell';

type Props = {
  params: Promise<{ flowId: string }>;
};

export default async function FlowEditorRoute({ params }: Props) {
  const { flowId } = await params;
  return <FlowEditorShell flowId={flowId} />;
}

export const dynamic = 'force-dynamic';
