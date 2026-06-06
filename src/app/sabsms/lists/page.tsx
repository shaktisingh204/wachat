/**
 * SabSMS lists — server entry.
 *
 * Resolves the workspace, hydrates the list catalog and the analytics
 * row, then hands them to `<ListsTable>` for the interactive UI.
 *
 * TODO(follow-up): register `sabsms_lists` in
 *   `src/lib/sabsms/db/collections.ts` so the read goes through
 *   `getSabsmsCollections()` with a typed Collection and the index
 *   spec runs at boot.
 */

import { getCachedSession } from "@/lib/server-cache";

import { ListsTable } from "./lists-table";
import { loadAnalytics, loadLists, type ListsListFilters } from "./actions";

export const dynamic = "force-dynamic";

interface SabsmsListsPageProps {
  searchParams: Promise<{
    q?: string;
    sort?: string;
    tag?: string;
  }>;
}

export default async function SabsmsListsPage({
  searchParams,
}: SabsmsListsPageProps) {
  const sp = await searchParams;
  const session = await getCachedSession();
  const workspaceId = String(
    (session?.user as { _id?: unknown } | undefined)?._id ?? "",
  );

  if (!workspaceId) {
    return (
      <div className="space-y-3 p-6">
        <h1 className="text-2xl font-semibold text-[var(--st-text)]">Lists</h1>
        <p className="text-sm text-[var(--st-text)]">
          Sign in to view your SabSMS lists.
        </p>
      </div>
    );
  }

  const filters: ListsListFilters = {
    q: sp.q,
    sort: (sp.sort as ListsListFilters["sort"]) ?? "newest",
    tag: sp.tag,
  };

  const [lists, analytics] = await Promise.all([
    loadLists(workspaceId, filters),
    loadAnalytics(workspaceId),
  ]);

  return (
    <ListsTable
      workspaceId={workspaceId}
      initialLists={lists}
      analytics={analytics}
    />
  );
}
