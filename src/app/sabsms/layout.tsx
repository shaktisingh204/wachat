
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { getCachedSession, getCachedProjects } from "@/lib/server-cache";
import { getActiveSabsmsProject } from "@/lib/sabsms/workspace";
import { RBACGuard } from "@/components/20ui-domain/rbac-guard";
import { ProjectProvider } from "@/context/project-context";

import { SabsmsShell } from "./_components/sabsms-shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SabSMS — SMS / MMS / RCS",
  description:
    "Multi-provider SMS, MMS and RCS messaging — campaigns, drips, two-way inbox, compliance, and analytics baked in.",
};

export default async function SabSmsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCachedSession();
  if (!session?.user) {
    redirect("/login");
  }
  const user = session.user as any;

  const onboarding = user.onboarding;
  if (onboarding && onboarding.status !== "complete") {
    redirect("/onboarding");
  }

  const projects = (await getCachedProjects()) || [];
  if (
    (!onboarding || onboarding.status !== "complete") &&
    projects.length === 0
  ) {
    redirect("/onboarding");
  }

  /* ── SabSMS gate: project → mandatory setup → use ──────────────────────
   * The selected SMS project lives in the `sabsms_project` cookie (server-
   * readable, unlike the client-only `activeProjectId`). The current path
   * is read from the `x-url` header the proxy sets on `/sabsms/*`.
   *   • no project selected            → /sabsms/projects (picker)
   *   • selected but setup incomplete  → /sabsms/setup     (wizard)
   * `/sabsms/projects` + `/sabsms/setup` are always allowed through.
   * `SabsmsShell` carries a client-side backstop for the rare case where
   * `x-url` is unavailable (pathname empty → no server redirect here). */
  const pathname = (await headers()).get("x-url") ?? "";
  const onPicker =
    pathname === "/sabsms/projects" || pathname.startsWith("/sabsms/projects/");
  const onSetup =
    pathname === "/sabsms/setup" || pathname.startsWith("/sabsms/setup/");

  const activeSmsProject = await getActiveSabsmsProject();
  const setupComplete = !!activeSmsProject?.sabsms?.setupComplete;

  if (pathname) {
    if (!activeSmsProject) {
      if (!onPicker) redirect("/sabsms/projects");
    } else if (!setupComplete) {
      if (!onSetup) redirect("/sabsms/setup");
    }
  }

  const credits = user?.credits;
  const totalCredits =
    typeof credits === "number"
      ? credits
      : credits && typeof credits === "object"
        ? Object.values(credits).reduce<number>(
            (sum, v) => sum + (typeof v === "number" ? v : 0),
            0,
          )
        : 0;

  const engineEnabled =
    (process.env.SABSMS_ENABLED ?? "false").toLowerCase() === "true";
  const engineUrl =
    process.env.SABSMS_ENGINE_URL ?? "http://localhost:4002";

  return (
    <RBACGuard>
      <ProjectProvider initialProjects={projects} user={user}>
        <SabsmsShell
          user={{
            name: user?.name,
            email: user?.email,
            avatar: user?.image,
          }}
          plan={{
            name: user?.plan?.name,
            credits: totalCredits,
          }}
          engineEnabled={engineEnabled}
          engineUrl={engineUrl}
          activeProjectId={activeSmsProject ? String(activeSmsProject._id) : null}
          activeProjectName={activeSmsProject?.name ?? null}
          setupComplete={setupComplete}
        >
          {children}
        </SabsmsShell>
      </ProjectProvider>
    </RBACGuard>
  );
}
