import { Network } from "lucide-react";

import { Card, EmptyState } from "@/components/sabcrm/20ui";
import { SabHrmPageShell } from "@/components/sabhrm/page-toolkit";
import { getOrgTree, type OrgNode } from "@/app/actions/sabhrm/org-chart.actions";

export const dynamic = "force-dynamic";

/** Recursive renderer — nested indented cards (no external chart lib). */
function OrgNodeView({ node, depth }: { node: OrgNode; depth: number }) {
  const initials = node.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <li>
      <div className="flex items-center gap-2.5 rounded-md border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--st-bg-muted)] text-xs font-medium text-[var(--st-text-secondary)]">
          {initials || "?"}
        </span>
        <div className="min-w-0">
          <span className="block truncate text-sm font-medium text-[var(--st-text)]">
            {node.name}
          </span>
          <span className="block truncate text-xs text-[var(--st-text-secondary)]">
            {node.title ?? "—"}
          </span>
        </div>
      </div>
      {node.children.length > 0 ? (
        <ul className="mt-2 ml-4 flex flex-col gap-2 border-l border-[var(--st-border)] pl-4">
          {node.children.map((child) => (
            <OrgNodeView key={child.id} node={child} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export default async function SabHrmOrgChartPage() {
  const res = await getOrgTree();
  const roots = res.ok ? res.data : [];
  const loadError = res.ok ? null : res.error;

  return (
    <SabHrmPageShell
      title="Org chart"
      description="Your reporting structure — every employee under their reporting manager."
    >
      {roots.length === 0 ? (
        <Card className="p-10">
          <EmptyState
            icon={<Network aria-hidden />}
            title={loadError ? "Couldn't load the org chart" : "No org structure yet"}
            description={
              loadError ??
              "Add employees and set their reporting managers to see your organization chart."
            }
          />
        </Card>
      ) : (
        <Card className="overflow-x-auto p-4">
          <ul className="flex flex-col gap-3">
            {roots.map((root) => (
              <OrgNodeView key={root.id} node={root} depth={0} />
            ))}
          </ul>
        </Card>
      )}
    </SabHrmPageShell>
  );
}
