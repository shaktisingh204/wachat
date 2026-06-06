/**
 * SabSMS imports — server entry.
 *
 * Resolves the active workspace, hydrates the import history (most
 * recent 200), and hands the slice to the `<ImportsTable>` client
 * component. Reads URL search params so deep links into a filtered
 * view render correctly without a client round-trip.
 *
 * TODO(follow-up): register `sabsms_imports` in
 *   `src/lib/sabsms/db/collections.ts` so the read goes through
 *   `getSabsmsCollections()` with a typed Collection and the index
 *   spec runs at boot.
 */

import { getCachedSession } from "@/lib/server-cache";

import { ImportsTable } from "./imports-table";
import { loadImports, type ImportsListFilters } from "./actions";

export const dynamic = "force-dynamic";

interface SabsmsImportsPageProps {
  searchParams: Promise<{
    q?: string;
    status?: string | string[];
    sort?: string;
    from?: string;
    to?: string;
  }>;
}

export default async function SabsmsImportsPage({
  searchParams,
}: SabsmsImportsPageProps) {
  const sp = await searchParams;
  const session = await getCachedSession();
  const workspaceId = String(
    (session?.user as { _id?: unknown } | undefined)?._id ?? "",
  );

  if (!workspaceId) {
    return (
      <div className="space-y-3 p-6">
        <h1 className="text-2xl font-semibold text-[var(--st-text)]">Imports</h1>
        <p className="text-sm text-[var(--st-text)]">
          Sign in to view your SabSMS imports.
        </p>
      </div>
    );
  }

  const filters: ImportsListFilters = {
    q: sp.q,
    status: Array.isArray(sp.status) ? sp.status : sp.status ? [sp.status] : undefined,
    sort: (sp.sort as ImportsListFilters["sort"]) ?? "newest",
    from: sp.from,
    to: sp.to,
  };

  const imports = await loadImports(workspaceId, filters);

  return (
    <ImportsTable workspaceId={workspaceId} initialImports={imports} />
  );
}
