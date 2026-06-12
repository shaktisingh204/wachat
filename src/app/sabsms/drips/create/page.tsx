/**
 * `/sabsms/drips/create` — new journey (V2.9).
 *
 * Renders the same linear-with-branches builder as the edit page with a
 * blank draft; the first save creates the journey and routes to
 * `/sabsms/drips/[id]`.
 */

import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";

import { listJourneyTemplateOptions } from "../[id]/actions";
import { JourneyBuilder } from "../[id]/builder";

export const dynamic = "force-dynamic";

export default async function CreateJourneyPage() {
  const templates = await listJourneyTemplateOptions();

  return (
    <SabsmsPageShell
      eyebrow="SabSMS · Outbound"
      title="New drip"
      description="Stack send / wait / wait-for-event / branch steps top to bottom. Save as a draft any time; activation runs the structural validation."
      breadcrumbs={[{ label: "Drips", href: "/sabsms/drips" }, { label: "New" }]}
    >
      <JourneyBuilder journey={null} templates={templates} />
    </SabsmsPageShell>
  );
}
