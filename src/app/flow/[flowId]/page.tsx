import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getSabFlowById } from '@/lib/sabflow/db';
import { ChatWindow } from '@/components/sabflow/chat/ChatWindow';
import '@/styles/sabflow.css';

type Props = {
  params: Promise<{ flowId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { flowId } = await params;
  const flow = await getSabFlowById(flowId);

  if (!flow) {
    return { title: 'Flow not found — SabFlow' };
  }

  return {
    title: `${flow.name} — SabFlow`,
    description: `Chat with the ${flow.name} automated assistant.`,
  };
}

export default async function PublicFlowPage({ params }: Props) {
  const { flowId } = await params;
  const flow = await getSabFlowById(flowId);

  if (!flow) {
    notFound();
  }

  if (flow.status !== 'PUBLISHED') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--gray-2)] p-6">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="h-12 w-12 rounded-full bg-[var(--gray-3)] flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="text-[var(--gray-9)]"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1 className="text-[16px] font-semibold text-[var(--gray-12)]">
            This flow is not available
          </h1>
          <p className="text-[13.5px] text-[var(--gray-9)] leading-relaxed">
            This flow has not been published yet or is no longer active.
          </p>
        </div>
      </div>
    );
  }

  // Serialise — MongoDB ObjectId is not plain JSON, convert to string.
  const serialised = JSON.parse(JSON.stringify(flow)) as typeof flow & { _id: string };

  return <ChatWindow flow={serialised} />;
}

export const dynamic = 'force-dynamic';
