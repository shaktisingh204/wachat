import { connectToDatabase } from "@/lib/mongodb";
import { getCachedSession } from "@/lib/server-cache";
import { SABSMS_COLLECTIONS } from "@/lib/sabsms/db/collections";

import { InboxLayout } from "./inbox-layout";
import {
  loadAgents,
  loadConversations,
  loadTemplates,
  loadThread,
} from "./actions";
import type { InboxFilters } from "./types";

/**
 * SabSMS inbox — server entry.
 *
 * Resolves the workspace, hydrates the initial conversation list,
 * thread, agent roster, and approved templates, then hands them to the
 * client-side `<InboxLayout>` for the 3-pane interactive UI.
 *
 * The page reads URL search params for the initial scope + selection so
 * deep links into `/sabsms/inbox?scope=unassigned&conversationId=…`
 * render correctly without a client round-trip. Connect-to-DB is the
 * only direct Mongo touch — every mutation flows through the server
 * actions in `./actions.ts`.
 */
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
      <div className="space-y-3 p-6">
        <h1 className="text-2xl font-semibold text-slate-800">Inbox</h1>
        <p className="text-sm text-slate-600">
          Sign in to view your SabSMS conversations.
        </p>
      </div>
    );
  }

  // The conversations collection is read via the typed helper; the
  // initial-thread lookup goes straight through `loadThread` so the
  // shape matches the client expectation 1:1.
  await connectToDatabase();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _collection = SABSMS_COLLECTIONS.conversations;

  const filters: InboxFilters = {
    q: sp.q,
    scope: (sp.scope as InboxFilters["scope"]) ?? "all",
    status: Array.isArray(sp.status)
      ? sp.status
      : sp.status
        ? [sp.status]
        : undefined,
    assignee: Array.isArray(sp.assignee)
      ? sp.assignee
      : sp.assignee
        ? [sp.assignee]
        : undefined,
    labels: Array.isArray(sp.label)
      ? sp.label
      : sp.label
        ? [sp.label]
        : undefined,
    sort: (sp.sort as InboxFilters["sort"]) ?? "newest",
    from: sp.from,
    to: sp.to,
  };

  const [conversations, agents, templates] = await Promise.all([
    loadConversations(workspaceId, filters),
    loadAgents(workspaceId),
    loadTemplates(workspaceId),
  ]);

  const initialThreadId =
    sp.conversationId ?? conversations[0]?.id ?? null;
  const initialThread = initialThreadId
    ? await loadThread(workspaceId, initialThreadId)
    : null;

  return (
    <InboxLayout
      workspaceId={workspaceId}
      initialConversations={conversations}
      initialThread={initialThread}
      templates={templates}
      agents={agents}
    />
  );
}
