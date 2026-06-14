import {
  listSlas,
  listSurveys,
} from "@/app/actions/sabchat-support.actions";
import {
  listBusinessHours,
  listTeams,
} from "@/app/actions/sabchat-ops.actions";

import { SettingsClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabchatSettingsPage() {
  const [slas, surveys, businessHours, teams] = await Promise.all([
    listSlas(),
    listSurveys(),
    listBusinessHours(),
    listTeams(),
  ]);
  return (
    <SettingsClient
      initialSlas={slas}
      initialSurveys={surveys}
      initialBusinessHours={businessHours}
      initialTeams={teams}
    />
  );
}
