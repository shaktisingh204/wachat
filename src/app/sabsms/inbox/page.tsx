import { Suspense } from "react";

import { connectToDatabase } from "@/lib/mongodb";
import { getCachedSession } from "@/lib/server-cache";
import { SABSMS_COLLECTIONS } from "@/lib/sabsms/db/collections";

import {
  loadAgents,
  loadConversations,
  loadTemplates,
  loadThread,
} from "./actions";
import type { InboxFilters } from "./types";

import { Card, ZoruCardTitle, ZoruCardDescription } from "@/components/zoruui";
import { InboxLayout } from "./inbox-layout";

export const dynamic = "force-dynamic";

interface SabsmsInboxPageProps {
  searchParams: Promise<{
    conversationId?: string;
    scope?: string;
    q?: string;
    sort?: string;
    status?: string | string[];
    assignee?: string | string[];
    label?: string | string[];
    from?: string;
    to?: string;
  }>;
}

export default async function SabsmsInboxPage({
  searchParams,
}: SabsmsInboxPageProps) {
  const sp = await searchParams;
  const session = await getCachedSession();
  const workspaceId = String((session?.user as { _id?: unknown } | undefined)?._id ?? "");

  if (!workspaceId) {
    return (
      <div className="flex h-[calc(100vh-100px)] items-center justify-center">
        <Card className="max-w-md w-full p-8 shadow-[var(--zoru-shadow-lg)] border-[var(--st-border)]">
          <ZoruCardTitle className="text-center text-3xl font-bold tracking-tight">Inbox</ZoruCardTitle>
          <ZoruCardDescription className="text-center mt-2 text-lg">
            Sign in to view your SabSMS conversations.
          </ZoruCardDescription>
        </Card>
      </div>
    );
  }

  await connectToDatabase();
  const _collection = SABSMS_COLLECTIONS.conversations;

  const filters: InboxFilters = {
    q: sp.q,
    scope: (sp.scope as InboxFilters["scope"]) ?? "all",
    status: Array.isArray(sp.status) ? sp.status : sp.status ? [sp.status] : undefined,
    assignee: Array.isArray(sp.assignee) ? sp.assignee : sp.assignee ? [sp.assignee] : undefined,
    labels: Array.isArray(sp.label) ? sp.label : sp.label ? [sp.label] : undefined,
    sort: (sp.sort as InboxFilters["sort"]) ?? "newest",
    from: sp.from,
    to: sp.to,
  };

  const [conversations, agents, templates] = await Promise.all([
    loadConversations(workspaceId, filters),
    loadAgents(workspaceId),
    loadTemplates(workspaceId),
  ]);

  const initialThreadId = sp.conversationId ?? conversations[0]?.id ?? null;
  const initialThread = initialThreadId ? await loadThread(workspaceId, initialThreadId) : null;

  return (
    // InboxLayout reads `useSearchParams()` (via useSabsmsUrlState) — it must
    // sit under a Suspense boundary or Next.js bails the whole route to an error.
    <Suspense fallback={null}>
      <InboxLayout
        workspaceId={workspaceId}
        initialConversations={conversations}
        initialThread={initialThread}
        templates={templates}
        agents={agents}
      />
    </Suspense>
  );
}
