import { redirect } from "next/navigation";

import {
  ensureDefaultPortal,
  listKbArticles,
} from "@/app/actions/sabchat-support.actions";

import { KnowledgeClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabchatKnowledgePage() {
  const portal = await ensureDefaultPortal();
  if (!portal) redirect("/sabchat/projects");
  const articles = await listKbArticles(portal._id);

  return (
    <KnowledgeClient
      portalId={portal._id}
      portalName={portal.name}
      initialArticles={articles}
    />
  );
}
