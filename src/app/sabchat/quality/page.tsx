import { redirect } from "next/navigation";

import { getSabchatWorkspaceId } from "@/lib/sabchat/workspace";
import { listQaRubrics, listQaScores } from "@/app/actions/sabchat-ops.actions";
import { listConversations } from "@/app/actions/sabchat-inbox.actions";

import { QualityClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabchatQualityPage() {
  const wsId = await getSabchatWorkspaceId();
  if (!wsId) redirect("/sabchat/projects");

  const [rubrics, scores, resolved] = await Promise.all([
    listQaRubrics(),
    listQaScores(),
    listConversations({ status: "resolved", limit: 40 }),
  ]);

  return (
    <QualityClient
      rubrics={rubrics}
      initialScores={scores}
      conversations={resolved.items.map((c) => ({
        id: c._id,
        label: c.lastMessagePreview || c._id.slice(-6),
      }))}
    />
  );
}
