import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";

import { getCachedSession } from "@/lib/server-cache";
import { getSabsmsCollections } from "@/lib/sabsms/db/collections";
import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";

import { DripBuilder } from "./builder";
import {
  loadDripById,
  loadOtherDripsForClone,
  loadTemplateOptions,
  type DripDoc,
} from "./actions";

/**
 * Drip builder page (Page 13 of `plans/sabsms-pages-catalog.md`).
 *
 * Server entry — hydrates the drip doc, approved templates, and other
 * drips (for the "Clone steps from another drip" feature) before
 * handing control to the client `<DripBuilder>`.
 *
 * Visiting `/sabsms/drips/new` creates a fresh empty draft (with a
 * start + exit node already wired up) and persists nothing until the
 * user clicks Save — at which point a new ObjectId is minted in the
 * `_id` field via the upsert in `saveDrip`.
 */

export const dynamic = "force-dynamic";

interface DripBuilderPageProps {
  params: Promise<{ id: string }>;
}

function emptyDripFor(workspaceId: string): DripDoc {
  const id = new ObjectId().toHexString();
  const now = new Date().toISOString();
  return {
    id,
    workspaceId,
    draft: {
      name: "Untitled drip",
      enabled: false,
      entryTrigger: { kind: "manual" },
      nodes: [
        { id: "start", kind: "start" },
        { id: "exit", kind: "exit" },
      ],
      edges: [{ id: "start->exit", from: "start", to: "exit" }],
      exitConditions: { unsubscribed: true },
    },
    enabled: false,
    activeRecipients: 0,
    errorCount: 0,
    versions: [],
    createdAt: now,
    updatedAt: now,
  };
}

export default async function SabsmsDripBuilderPage({
  params,
}: DripBuilderPageProps) {
  const { id } = await params;

  const session = await getCachedSession();
  const workspaceId = String(
    (session?.user as { _id?: unknown } | undefined)?._id ?? "",
  );

  if (!workspaceId) {
    return (
      <SabsmsPageShell
        eyebrow="SabSMS"
        title="Drip builder"
        description="Sign in to view this drip."
        breadcrumbs={[
          { label: "Drips", href: "/sabsms/drips" },
          { label: "Builder" },
        ]}
      >
        <div className="rounded-md border border-dashed border-[var(--st-border)] bg-white p-10 text-center text-sm text-[var(--st-text)]">
          Workspace not resolved.
        </div>
      </SabsmsPageShell>
    );
  }

  // Side-effect: ensure indexes get created at least once.
  await getSabsmsCollections();

  let drip: DripDoc | null = null;
  if (id === "new") {
    drip = emptyDripFor(workspaceId);
  } else {
    drip = await loadDripById(workspaceId, id);
  }

  if (!drip) notFound();

  const [templates, otherDrips] = await Promise.all([
    loadTemplateOptions(workspaceId),
    loadOtherDripsForClone(workspaceId, drip.id),
  ]);

  return (
    <SabsmsPageShell
      eyebrow="SabSMS · Outbound"
      title={drip.draft.name || "Untitled drip"}
      description={
        <>
          Visual drip builder — every step compiles to the engine&rsquo;s{" "}
          <code className="rounded bg-[var(--st-bg-muted)] px-1 py-0.5 text-[11px]">steps[]</code>{" "}
          format. Validate as you build; save with{" "}
          <span className="font-mono">⌘S</span>.
        </>
      }
      breadcrumbs={[
        { label: "Drips", href: "/sabsms/drips" },
        { label: drip.draft.name || "Builder" },
      ]}
      helpTitle="How drip builder works"
      helpBody={
        <div className="space-y-2">
          <p>
            Every drip has a single <em>start</em> node and at least one{" "}
            <em>exit</em>. Add <strong>message</strong>, <strong>wait</strong>, and{" "}
            <strong>branch</strong> steps between them.
          </p>
          <p>
            Branches split on whether the contact <em>replied</em>,{" "}
            <em>clicked</em>, or <em>opened</em>. Each branch needs a{" "}
            <em>yes</em> and <em>no</em> path.
          </p>
        </div>
      }
    >
      <DripBuilder drip={drip} templates={templates} otherDrips={otherDrips} />
    </SabsmsPageShell>
  );
}
