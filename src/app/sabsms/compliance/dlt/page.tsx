import { getSabsmsWorkspaceId } from "@/lib/sabsms/workspace";
import { Suspense } from "react";

import { SabsmsPageShell } from "@/components/sabsms/page-toolkit/sabsms-page-shell";
import { getCachedSession } from "@/lib/server-cache";

import { loadDltRegistryAction } from "./actions";
import { DltHubClient } from "./dlt-client";

export const dynamic = "force-dynamic";

async function DltDataLoader() {
  const session = await getCachedSession();
  const workspaceId = (await getSabsmsWorkspaceId()) ?? "";
  if (!workspaceId) {
    return (
      <p className="text-sm text-[var(--st-text)]">
        You need to sign in to manage DLT registrations.
      </p>
    );
  }

  const res = await loadDltRegistryAction();
  if (!res.success) {
    return <p className="text-sm text-[var(--st-text)]">{res.error}</p>;
  }

  return <DltHubClient initial={res.registry} />;
}

export default function DltRegistrationPage() {
  return (
    <SabsmsPageShell
      title="India DLT"
      description="Mirror your operator-portal registrations — principal entities, headers, content templates, and the PE→TM chain. The engine scrubs every India send against this registry."
      eyebrow="Compliance"
      breadcrumbs={[
        { label: "SabSMS", href: "/sabsms" },
        { label: "Compliance", href: "/sabsms/compliance" },
        { label: "DLT" },
      ]}
      helpTitle="How DLT scrubbing works"
      helpBody={
        <ul className="list-disc space-y-1 pl-4">
          <li>
            Register here exactly what your DLT portal (Airtel / Jio / VIL /
            BSNL) shows — PE IDs, header IDs, approved template bodies with{" "}
            <code className="rounded bg-[var(--st-bg-muted)] px-1">{"{#var#}"}</code>{" "}
            placeholders, and your telemarketer chain.
          </li>
          <li>
            The engine caches this registry for 60 seconds and checks every
            India-bound message against it before handing off to the provider.
          </li>
          <li>
            Use the template editor&apos;s DLT scrub card to test a body
            against the registry before sending.
          </li>
        </ul>
      }
    >
      <Suspense
        fallback={
          <div className="h-96 w-full animate-pulse rounded-xl bg-[var(--st-bg-muted)]" />
        }
      >
        <DltDataLoader />
      </Suspense>
    </SabsmsPageShell>
  );
}
