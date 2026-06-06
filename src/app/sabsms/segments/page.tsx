import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";
import { getCachedSession } from "@/lib/server-cache";

import { listSegments } from "./actions";
import { SegmentsTable } from "./segments-table";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    kind?: string;
    archived?: string;
    sort?: string;
    page?: string;
    pageSize?: string;
  }>;
}

export default async function SabsmsSegmentsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const session = await getCachedSession();
  const workspaceId = String(
    (session?.user as { _id?: unknown } | undefined)?._id ?? "",
  );

  if (!workspaceId) {
    return (
      <SabsmsPageShell
        title="Segments"
        description="Sign in to manage audience predicates."
        breadcrumbs={[{ label: "Segments" }]}
      >
        <p className="text-sm text-[var(--st-text)]">
          You must be signed in to see this page.
        </p>
      </SabsmsPageShell>
    );
  }

  const res = await listSegments({
    search: sp.q,
    kind:
      sp.kind === "static" || sp.kind === "dynamic" ? sp.kind : undefined,
    showArchived: sp.archived === "1",
    sort: (sp.sort as
      | "updatedAt:desc"
      | "updatedAt:asc"
      | "name:asc"
      | "name:desc"
      | "size:desc"
      | "size:asc"
      | undefined) ?? undefined,
    page: sp.page ? Math.max(1, parseInt(sp.page, 10) || 1) : 1,
    pageSize: sp.pageSize
      ? Math.min(250, parseInt(sp.pageSize, 10) || 50)
      : 50,
  });

  const rows = res.ok ? res.rows : [];
  const total = res.ok ? res.total : 0;
  const errorMessage = res.ok ? null : res.error;

  return (
    <SabsmsPageShell
      title="Segments"
      description={
        <span>
          Audience predicates power campaigns, drips and exports. Build static
          snapshots or dynamic queries that re-evaluate on read.
        </span>
      }
      breadcrumbs={[{ label: "Segments" }]}
      helpTitle="What is a segment?"
      helpBody={
        <div className="space-y-2">
          <p>
            A segment is a filter over your contacts. Static segments freeze the
            membership list at save time; dynamic segments re-evaluate every
            time they are read.
          </p>
          <p className="text-xs text-[var(--st-text)]">
            Marketing segments must include a consent gate
            (<code>unsubscribed = false</code>) — the builder will block save
            otherwise.
          </p>
        </div>
      }
      primaryAction={{ label: "New segment", href: "/sabsms/segments/new" }}
      secondaryActions={[
        {
          label: "View campaigns using segments",
          onSelectHref: "/sabsms/campaigns",
        },
        {
          label: "View drips using segments",
          onSelectHref: "/sabsms/drips",
        },
      ]}
    >
      {errorMessage ? (
        <div className="rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3 text-sm text-[var(--st-text)]">
          {errorMessage}
        </div>
      ) : null}
      <SegmentsTable
        workspaceId={workspaceId}
        initialRows={rows}
        total={total}
      />
    </SabsmsPageShell>
  );
}
