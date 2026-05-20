import { RouteComingSoon } from "@/components/zoruui";

export const dynamic = "force-dynamic";

const TITLES: Record<string, string> = {
  inbox: "Inbox — Coming in Phase 2",
  campaigns: "Campaigns — Coming in Phase 4",
  templates: "Templates — Coming in Phase 3",
  drips: "Drip sequences — Coming in Phase 4",
  contacts: "Contacts — Coming in Phase 2",
  suppressions: "Suppressions — Coming in Phase 8",
  consent: "Consent log — Coming in Phase 8",
  numbers: "Numbers — Coming in Phase 1.5",
  providers: "Providers — Coming in Phase 1.5",
  analytics: "Analytics — Coming in Phase 11",
  compliance: "Compliance — Coming in Phase 8",
  logs: "Message logs — Coming in Phase 2",
  webhooks: "Outbound webhooks — Coming in Phase 12",
  "api-keys": "API keys — Coming in Phase 12",
  settings: "Settings — Coming in Phase 1.5",
};

export default async function SabsmsCatchAllPage({
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
