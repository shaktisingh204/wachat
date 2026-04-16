import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getSabFlow } from '@/app/actions/sabflow';
import { SharePanelClient } from '@/components/sabflow/panels/SharePanelClient';

type Props = {
  params: Promise<{ flowId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { flowId } = await params;
  const flow = await getSabFlow(flowId);
  return {
    title: flow ? `Share "${flow.name}" — SabFlow` : 'Flow not found — SabFlow',
  };
}

export default async function SharePage({ params }: Props) {
  const { flowId } = await params;
  const flow = await getSabFlow(flowId);

  if (!flow) {
    notFound();
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const shareUrl = `${appUrl}/flow/${flow._id}`;

  return (
    <SharePanelClient
      flowId={flow._id as string}
      flowName={flow.name}
      shareUrl={shareUrl}
      initialPublicLinkEnabled={!!(flow.settings as Record<string, unknown>)?.publicLinkEnabled}
    />
  );
}

export const dynamic = 'force-dynamic';
