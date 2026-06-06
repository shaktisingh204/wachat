import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getSabFlowById } from '@/lib/sabflow/db';
import { ChatWindow } from '@/components/sabflow/chat/ChatWindow';
import type { SabFlowDoc } from '@/lib/sabflow/types';
import '@/components/sabflow/sabflow.css';

type Props = {
  params: Promise<{ flowId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { flowId } = await params;
    const flow = await getSabFlowById(flowId);

    if (!flow) {
      return { title: 'Flow not found — SabFlow' };
    }

    return {
      title: `${flow.name} — SabFlow`,
      description: `Chat with the ${flow.name} automated assistant.`,
    };
  } catch (error) {
    return { title: 'Error — SabFlow' };
  }
}

// Ensure the serialised type strictly matches what the client component expects
type SerialisedFlow = Omit<SabFlowDoc, '_id' | 'createdAt' | 'updatedAt'> & {
  _id: string;
  createdAt: string;
  updatedAt: string;
};

function UnpublishedFlow() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--gray-2)] p-6">
      <div className="flex flex-col items-center gap-4 text-center max-w-sm bg-white p-8 rounded-2xl shadow-sm border border-[var(--st-border)]">
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
        <h1 className="text-[18px] font-semibold text-[var(--gray-12)] tracking-tight">
          Flow not available
        </h1>
        <p className="text-[14px] text-[var(--gray-9)] leading-relaxed">
          This automated assistant is currently inactive or has not been published yet. Please check back later.
        </p>
      </div>
    </div>
  );
}

export default async function PublicFlowPage({ params }: Props) {
  try {
    const { flowId } = await params;
    const flow = await getSabFlowById(flowId);

    if (!flow) {
      notFound();
    }

    if (flow.status !== 'PUBLISHED') {
      return <UnpublishedFlow />;
    }

    // Safely serialise to prevent hydration mismatches with non-isomorphic dates and ObjectIds.
    const serialised: SerialisedFlow = JSON.parse(JSON.stringify(flow));

    // Force cast for ChatWindow to accept it if its types are slightly mismatched
    return <ChatWindow flow={serialised as any} />;
  } catch (error) {
    // Let error.tsx handle the UI for unexpected errors
    throw new Error('Failed to load the flow. Please try again later.');
  }
}

export const dynamic = 'force-dynamic';
