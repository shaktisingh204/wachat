import { ObjectId } from "mongodb";
import { notFound } from "next/navigation";
import React, { Suspense } from "react";

import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";
import { getCachedSession } from "@/lib/server-cache";
import { getSabsmsCollections } from "@/lib/sabsms/db/collections";
import type {
  SabsmsTemplate,
  SabsmsTemplateBody,
} from "@/lib/sabsms/types";

import { loadDltRegistryAction } from "../../compliance/dlt/actions";
import type { DltBindingRegistry } from "./dlt-scrub-panel";
import { TemplateEditor } from "./editor";
import {
  emptyViewModel,
  fromTemplateDoc,
  type TemplateEditorViewModel,
} from "./types";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface TemplateDocWithHistory extends SabsmsTemplate {
  lastPublishedBodies?: SabsmsTemplateBody[];
}

async function loadTemplate(
  id: string,
  workspaceId: string,
): Promise<TemplateEditorViewModel | null> {
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return null;
  }
  const { cols } = await getSabsmsCollections();
  const doc = (await cols.templates.findOne({
    _id: oid,
    workspaceId,
  })) as TemplateDocWithHistory | null;
  if (!doc) return null;
  return fromTemplateDoc(doc, doc.lastPublishedBodies ?? null);
}

async function TemplateDataLoader({ id, isNew }: { id: string; isNew: boolean }) {
  const session = await getCachedSession();
  const workspaceId = String((session?.user as any)?._id ?? "");

  if (!workspaceId) {
    return (
      <p className="text-sm text-[var(--st-text)]">
        You need to sign in to edit templates.
      </p>
    );
  }

  const vm = isNew ? emptyViewModel() : await loadTemplate(id, workspaceId);
  if (!vm) notFound();

  // Workspace DLT registry (V2.8) for the live scrub card — active
  // templates + headers only, slimmed to what the binding pickers need.
  let dltRegistry: DltBindingRegistry = { templates: [], headers: [] };
  const reg = await loadDltRegistryAction();
  if (reg.success) {
    dltRegistry = {
      templates: reg.registry.templates
        .filter((t) => t.status === "active")
        .map((t) => ({
          templateId: t.templateId,
          body: t.body,
          category: t.category,
          peId: t.peId,
        })),
      headers: reg.registry.headers.map((h) => ({
        headerId: h.headerId,
        header: h.header,
        category: h.category,
      })),
    };
  }

  return <TemplateEditor initial={vm} isNew={isNew} dltRegistry={dltRegistry} />;
}

export default async function TemplateEditorPage({ params }: PageProps) {
  const { id } = await params;
  const isNew = id === "new";
  
  return (
    <SabsmsPageShell
      eyebrow="SabSMS"
      title={isNew ? "New template" : "Edit Template"}
      description={
        isNew
          ? "Compose a message template, add variables, and submit it for carrier approval."
          : "Variables, carrier registration, AI assistance, and version diffs."
      }
      breadcrumbs={[
        { label: "Templates", href: "/sabsms/templates" },
        { label: isNew ? "New" : "Edit" },
      ]}
      helpTitle="Template editor"
      helpBody={
        <ul className="list-disc pl-4 space-y-1">
          <li>
            Use <code className="rounded bg-[var(--st-bg-muted)] px-1">{"{{ var }}"}</code>{" "}
            for substitutions and{" "}
            <code className="rounded bg-[var(--st-bg-muted)] px-1">
              {"{% if x %}…{% endif %}"}
            </code>{" "}
            for conditionals.
          </li>
          <li>
            Locale switcher uses segmented buttons — Ui20 has no tab
            primitive.
          </li>
          <li>
            Cmd+S saves draft, Cmd+Enter publishes, Cmd+/ toggles the
            variables panel.
          </li>
        </ul>
      }
    >
      <Suspense fallback={<div className="h-96 w-full bg-[var(--st-bg-muted)] animate-pulse rounded-xl" />}>
        <TemplateDataLoader id={id} isNew={isNew} />
      </Suspense>
    </SabsmsPageShell>
  );
}
