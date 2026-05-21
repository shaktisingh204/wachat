import { ObjectId } from "mongodb";
import { notFound } from "next/navigation";

import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";
import { getCachedSession } from "@/lib/server-cache";
import { getSabsmsCollections } from "@/lib/sabsms/db/collections";
import type {
  SabsmsTemplate,
  SabsmsTemplateBody,
} from "@/lib/sabsms/types";

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

export default async function TemplateEditorPage({ params }: PageProps) {
  const { id } = await params;

  const session = await getCachedSession();
  const workspaceId = String((session?.user as any)?._id ?? "");
  if (!workspaceId) {
    return (
      <SabsmsPageShell
        title="Sign in required"
        breadcrumbs={[
          { label: "Templates", href: "/sabsms/templates" },
          { label: "Editor" },
        ]}
      >
        <p className="text-sm text-slate-600">
          You need to sign in to edit templates.
        </p>
      </SabsmsPageShell>
    );
  }

  const isNew = id === "new";
  const vm = isNew ? emptyViewModel() : await loadTemplate(id, workspaceId);
  if (!vm) notFound();

  return (
    <SabsmsPageShell
      eyebrow="SabSMS"
      title={isNew ? "New template" : `Edit · ${vm.name || "(untitled)"}`}
      description={
        isNew
          ? "Compose a message template, add variables, and submit it for carrier approval."
          : "Variables, carrier registration, AI assistance, and version diffs."
      }
      breadcrumbs={[
        { label: "Templates", href: "/sabsms/templates" },
        { label: isNew ? "New" : vm.name || "(untitled)" },
      ]}
      helpTitle="Template editor"
      helpBody={
        <ul className="list-disc pl-4 space-y-1">
          <li>
            Use <code className="rounded bg-slate-100 px-1">{"{{ var }}"}</code>{" "}
            for substitutions and{" "}
            <code className="rounded bg-slate-100 px-1">
              {"{% if x %}…{% endif %}"}
            </code>{" "}
            for conditionals.
          </li>
          <li>
            Locale switcher uses segmented buttons — ZoruUI has no tab
            primitive.
          </li>
          <li>
            Cmd+S saves draft, Cmd+Enter publishes, Cmd+/ toggles the
            variables panel.
          </li>
        </ul>
      }
    >
      <TemplateEditor initial={vm} isNew={isNew} />
    </SabsmsPageShell>
  );
}
