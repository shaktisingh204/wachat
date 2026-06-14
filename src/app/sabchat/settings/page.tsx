import {
  listSlas,
  listSurveys,
} from "@/app/actions/sabchat-support.actions";

import { SettingsClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabchatSettingsPage() {
  const [slas, surveys] = await Promise.all([listSlas(), listSurveys()]);
  return <SettingsClient initialSlas={slas} initialSurveys={surveys} />;
}
