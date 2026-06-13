import { getSabsmsWorkspaceId } from "@/lib/sabsms/workspace";
import React from "react";
import { ObjectId } from "mongodb";

import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";
import { getCachedSession } from "@/lib/server-cache";
import { getSabsmsCollections } from "@/lib/sabsms/db/collections";
import type { SabsmsCampaign, SabsmsNumber, SabsmsTemplate } from "@/lib/sabsms/types";

import { CampaignWizard } from "./wizard";
import { type ContactOption, type SegmentOption } from "./steps/step-audience";
import { type SenderNumberOption } from "./steps/step-sender";
import { type TemplateOption } from "./steps/step-template";
import { makeEmptyDraft, type CampaignDraft } from "./types";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ draftId?: string }>;
}

function mongoIdString(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (value instanceof ObjectId) return value.toHexString();
  return undefined;
}

function templateToOption(t: SabsmsTemplate): TemplateOption {
  return {
    id: mongoIdString(t._id) ?? "",
    name: t.name,
    category: t.category,
    status: t.status,
    bodies: t.bodies.map((b) => ({ locale: b.locale, body: b.body })),
    variables: t.variables,
  };
}

function numberToOption(n: SabsmsNumber): SenderNumberOption {
  return {
    id: mongoIdString(n._id) ?? n.e164,
    e164: n.e164,
    country: n.country,
    type: n.type,
  };
}

/**
 * Map a persisted campaign's audience onto the wizard's narrower
 * `AudienceDraft`. The wizard only edits segment / contacts / CSV; list /
 * phones audiences (set by the quick-create or API) are surfaced as an empty
 * picker the user re-selects, rather than silently mistyped.
 */
function campaignAudienceToDraft(
  audience: SabsmsCampaign["audience"],
): CampaignDraft["audience"] {
  switch (audience.kind) {
    case "segment":
      return { kind: "segment", segmentId: audience.segmentId };
    case "contacts":
      return { kind: "contacts", contactIds: audience.contactIds };
    case "csv":
      return { kind: "csv", sabFileId: audience.sabFileId ?? "" };
    default:
      // list / phones aren't wizard-editable — start fresh.
      return undefined;
  }
}

function campaignToDraft(
  c: SabsmsCampaign,
  workspaceId: string,
): CampaignDraft {
  const base = makeEmptyDraft(workspaceId);
  return {
    ...base,
    id: mongoIdString(c._id),
    workspaceId,
    name: c.name,
    templateId: c.templateId,
    audience: campaignAudienceToDraft(c.audience),
    schedule:
      c.schedule.kind === "scheduled"
        ? {
            kind: "scheduled",
            sendAt:
              c.schedule.sendAt instanceof Date
                ? c.schedule.sendAt.toISOString().slice(0, 16)
                : String(c.schedule.sendAt),
          }
        : c.schedule,
    senderStrategy: c.senderStrategy,
    senderNumberIds: c.senderNumberIds,
    throttlePerSecond: c.throttlePerSecond,
    category: c.category,
    status: c.status,
  };
}

async function NewCampaignPageContent({ searchParams }: PageProps) {
  const sp = await searchParams;
  const session = await getCachedSession();
  const workspaceId = (await getSabsmsWorkspaceId()) ?? "";

  const { cols, db } = await getSabsmsCollections();

  // Pull templates + numbers in parallel. Both filtered to the
  // workspace and to launch-ready statuses.
  const [templatesDocs, numbersDocs] = await Promise.all([
    cols.templates
      .find({ workspaceId, status: { $in: ["approved", "draft"] } })
      .sort({ updatedAt: -1 })
      .limit(200)
      .toArray(),
    cols.numbers
      .find({ workspaceId, status: "active" })
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray(),
  ]);

  // Drips list — for the schedule step's drip kind.
  const dripsDocs = await cols.drips
    .find({ workspaceId, enabled: true })
    .limit(100)
    .toArray();
  const drips = dripsDocs.map((d) => ({
    id: mongoIdString(d._id) ?? "",
    name: d.name,
  }));

  // Contacts — best-effort. `sabsms_contacts` is provisional; if the
  // collection is missing or empty we just render an empty picker.
  let contacts: ContactOption[] = [];
  try {
    const raw = await db
      .collection("sabsms_contacts")
      .find({ workspaceId })
      .project({ _id: 1, name: 1, phone: 1 })
      .limit(200)
      .toArray();
    contacts = raw.map((c) => ({
      id: mongoIdString(c._id) ?? "",
      name: (c as { name?: string }).name ?? "(unnamed)",
      phone: (c as { phone?: string }).phone ?? "",
    }));
  } catch {
    contacts = [];
  }

  // Segments — backed by crm_segments.
  let segments: SegmentOption[] = [];
  try {
    const raw = await db
      .collection("crm_segments")
      .find({ workspaceId })
      .project({ _id: 1, name: 1, count: 1 })
      .limit(200)
      .toArray();
    segments = raw.map((c) => ({
      id: mongoIdString(c._id) ?? "",
      name: (c as { name?: string }).name ?? "(unnamed)",
      count: (c as { count?: number }).count,
    }));
  } catch {
    segments = [];
  }

  const templates = templatesDocs.map(templateToOption);
  const numbers = numbersDocs.map(numberToOption);

  // Auto-resume from ?draftId=
  let initialDraft: CampaignDraft | undefined;
  if (sp.draftId && ObjectId.isValid(sp.draftId)) {
    const doc = await cols.campaigns.findOne({
      _id: new ObjectId(sp.draftId),
      workspaceId,
    });
    if (doc) initialDraft = campaignToDraft(doc, workspaceId);
  }

  return (
    <SabsmsPageShell
      title="New campaign"
      description="Step through template, audience, sender, schedule, throttle, compliance, and review. Drafts auto-save to your browser as you go."
      breadcrumbs={[
        { label: "Campaigns", href: "/sabsms/campaigns" },
        { label: "New" },
      ]}
    >
      <CampaignWizard
        workspaceId={workspaceId}
        initialDraft={initialDraft}
        templates={templates}
        segments={segments}
        contacts={contacts}
        numbers={numbers}
        drips={drips}
      />
    </SabsmsPageShell>
  );
}


export default function NewCampaignPage({ searchParams }: PageProps) {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <NewCampaignPageContent searchParams={searchParams} />
    </React.Suspense>
  );
}
