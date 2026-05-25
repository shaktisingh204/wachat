import React from "react";
import { RouteComingSoon } from "@/components/zoruui";

export const dynamic = "force-dynamic";

const TITLES: Record<string, string> = {
  // /sabsms, /sabsms/send, /sabsms/inbox, /sabsms/logs, /sabsms/numbers,
  // /sabsms/providers all have real pages — they never hit this catch-all.
  campaigns: "Campaigns — Coming in Phase 4",
  templates: "Templates — Coming in Phase 3",
  drips: "Drip sequences — Coming in Phase 4",
  contacts: "Contacts — Coming in Phase 2",
  suppressions: "Suppressions — Coming in Phase 8",
  consent: "Consent log — Coming in Phase 8",
  analytics: "Analytics — Coming in Phase 11",
  compliance: "Compliance — Coming in Phase 8",
  webhooks: "Outbound webhooks — Coming in Phase 12",
  "api-keys": "API keys — Coming in Phase 12",
  settings: "Settings — Coming in Phase 1.5",
};

async function SabsmsCatchAllPageContent({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const key = slug?.[0] ?? "";
  const title = TITLES[key] ?? `SabSMS · /${(slug ?? []).join("/")}`;
  return (
    <RouteComingSoon
      title={title}
      description="The route is reserved — the feature ships in a follow-up phase. See plans/sabsms-world-class-plan.md for the schedule."
      parentHref="/sabsms"
      parentLabel="Back to SabSMS overview"
    />
  );
}


export default function SabsmsCatchAllPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <SabsmsCatchAllPageContent params={params} />
    </React.Suspense>
  );
}
