/**
 * `/sabsms/drips/[id]` — journey edit page (V2.9).
 *
 * Server entry: loads the journey (workspace-scoped) + template picker
 * options, then hands everything to the client builder.
 */

import { notFound } from "next/navigation";

import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";

import { listJourneyTemplateOptions, loadJourneyDetail } from "./actions";
import { JourneyBuilder } from "./builder";

export const dynamic = "force-dynamic";

interface JourneyEditPageProps {
  params: Promise<{ id: string }>;
}

export default async function JourneyEditPage({ params }: JourneyEditPageProps) {
  const { id } = await params;

  const [detail, templates] = await Promise.all([
    loadJourneyDetail(id),
    listJourneyTemplateOptions(),
  ]);
  if (!detail.ok) notFound();

  return (
    <SabsmsPageShell
      eyebrow="SabSMS · Outbound"
      title={detail.journey.name}
      description="Edit the steps, branches, and A/B arms of this journey. Activation validates the structure; live runs keep flowing from their saved step pointers."
      breadcrumbs={[{ label: "Drips", href: "/sabsms/drips" }, { label: detail.journey.name }]}
    >
      <JourneyBuilder journey={detail.journey} templates={templates} />
    </SabsmsPageShell>
  );
}
