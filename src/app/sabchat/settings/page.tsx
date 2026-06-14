import {
  listSlas,
  listSurveys,
} from "@/app/actions/sabchat-support.actions";
import {
  listBusinessHours,
  listTeams,
  listRetention,
  listSso,
  listScimTokens,
} from "@/app/actions/sabchat-ops.actions";

import { SettingsClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabchatSettingsPage() {
  const [slas, surveys, businessHours, teams, retention, sso, scim] =
    await Promise.all([
      listSlas(),
      listSurveys(),
      listBusinessHours(),
      listTeams(),
      listRetention(),
      listSso(),
      listScimTokens(),
    ]);
  return (
    <SettingsClient
      initialSlas={slas}
      initialSurveys={surveys}
      initialBusinessHours={businessHours}
      initialTeams={teams}
      initialRetention={retention}
      initialSso={sso}
      initialScim={scim}
    />
  );
}
