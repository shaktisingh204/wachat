import { ObjectId } from "mongodb";

import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";
import { connectToDatabase } from "@/lib/mongodb";
import { getCachedSession } from "@/lib/server-cache";

import { SegmentBuilder } from "./builder";
import { emptyGroup, type SegmentNode } from "./evaluate";
import type { SegmentBuilderDraft } from "./actions";

const SEGMENTS_COLLECTION = "sabsms_segments";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ id?: string }>;
}

interface SavedSegmentDocRow {
  _id?: ObjectId;
  name: string;
  description?: string;
  kind?: "static" | "dynamic";
  predicate: SegmentNode | null;
  category?: SegmentBuilderDraft["category"];
  autoRefreshSeconds?: number;
  tags?: string[];
}

export default async function SegmentBuilderPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const session = await getCachedSession();
  const workspaceId = String(
    (session?.user as { _id?: unknown } | undefined)?._id ?? "",
  );

  if (!workspaceId) {
    return (
      <SabsmsPageShell
        title="New segment"
        breadcrumbs={[
          { label: "Segments", href: "/sabsms/segments" },
          { label: "New" },
        ]}
      >
        <p className="text-sm text-[var(--st-text)]">Sign in to build a segment.</p>
      </SabsmsPageShell>
    );
  }

  const { db } = await connectToDatabase();

  // Load existing segment if `?id=` provided.
  let initialDraft: SegmentBuilderDraft | undefined;
  if (sp.id && ObjectId.isValid(sp.id)) {
    const doc = (await db
      .collection<SavedSegmentDocRow>(SEGMENTS_COLLECTION)
      .findOne({
        _id: new ObjectId(sp.id),
        workspaceId,
      } as unknown as { _id: ObjectId; workspaceId: string })) as
      | (SavedSegmentDocRow & { workspaceId?: string })
      | null;
    if (doc) {
      initialDraft = {
        id: sp.id,
        name: doc.name,
        description: doc.description,
        predicate: doc.predicate ?? emptyGroup("and"),
        category: (doc.category ?? "marketing") as SegmentBuilderDraft["category"],
        kind: doc.kind ?? "dynamic",
        autoRefreshSeconds: doc.autoRefreshSeconds,
        tags: doc.tags ?? [],
        // Once a segment is loaded for editing we assume the operator
        // already attested at create time; they re-confirm only if they
        // change category to marketing later in the session.
        attestation: doc.category === "marketing",
      };
    }
  }

  // Load importable segments (for the "Import predicate" picker).
  const importableDocs = await db
    .collection(SEGMENTS_COLLECTION)
    .find({ workspaceId })
    .project({ _id: 1, name: 1 })
    .sort({ updatedAt: -1 })
    .limit(50)
    .toArray()
    .catch(() => []);
  const importableSegments = importableDocs
    .filter((d) => !sp.id || String((d as { _id?: unknown })._id) !== sp.id)
    .map((d) => ({
      id: String((d as { _id?: unknown })._id ?? ""),
      name: String((d as { name?: unknown }).name ?? "(unnamed)"),
    }));

  return (
    <SabsmsPageShell
      title={initialDraft ? `Edit segment` : "New segment"}
      description="Visual predicate builder with live count, sample preview, and one-click cost forecast."
      breadcrumbs={[
        { label: "Segments", href: "/sabsms/segments" },
        { label: initialDraft ? initialDraft.name : "New" },
      ]}
      helpTitle="Building good segments"
      helpBody={
        <div className="space-y-2 text-sm">
          <p>
            Combine rules with AND / OR groups. Use dynamic mode for "rolling"
            audiences (e.g. "clicked in the last 30 days"); pick static mode
            when you need a frozen list (e.g. "anyone matching at 9 AM today").
          </p>
          <p className="text-xs text-[var(--st-text)]">
            Marketing segments must include a consent gate
            (<code>unsubscribed = false</code>) before they can save.
          </p>
        </div>
      }
    >
      <SegmentBuilder
        workspaceId={workspaceId}
        initialDraft={initialDraft}
        initialId={sp.id}
        importableSegments={importableSegments}
      />
    </SabsmsPageShell>
  );
}
