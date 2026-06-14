import { getSabHrmSettings } from "@/app/actions/sabhrm/settings.actions";

import { SettingsClient } from "./_client";

export const dynamic = "force-dynamic";

const FALLBACK = {
  name: "",
  legalName: "",
  region: "IN" as const,
  currency: "INR",
  fiscalYearStartMonth: 4,
  timezone: "",
};

export default async function SabHrmSettingsPage() {
  const res = await getSabHrmSettings();

  return (
    <SettingsClient
      initial={res.ok ? res.data : FALLBACK}
      loadError={res.ok ? null : res.error}
    />
  );
}
