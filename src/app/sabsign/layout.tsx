import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { getCachedSession, getCachedProjects } from "@/lib/server-cache";
import { getActiveSabsignProject } from "@/lib/sabsign/workspace";
import { RBACGuard } from "@/components/20ui-domain/rbac-guard";
import { ProjectProvider } from "@/context/project-context";

import { SabsignShell } from "./_components/sabsign-shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SabSign — e-signatures",
  description:
    "Send, sign and e-stamp documents — WYSIWYG field builder, multiple signers, automated reminders, tamper-evident audit trail and white-label, all native.",
};

export default async function SabSignLayout({
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

  /* ── SabSign gate: project → mandatory setup → use ─────────────────────
   * The selected signing project lives in the `sabsign_project` cookie
   * (server-readable). The current path is read from the `x-url` header the
   * proxy sets on `/sabsign/*`.
   *   • no project selected            → /sabsign/projects (picker)
   *   • selected but setup incomplete  → /sabsign/setup     (wizard)
   * `/sabsign/{projects,setup,kiosk}` are always allowed through. The kiosk
   * is an in-person device flow and must not be gate-redirected. */
  const pathname = (await headers()).get("x-url") ?? "";
  const onPicker =
    pathname === "/sabsign/projects" || pathname.startsWith("/sabsign/projects/");
  const onSetup =
    pathname === "/sabsign/setup" || pathname.startsWith("/sabsign/setup/");
  const onKiosk = pathname.startsWith("/sabsign/kiosk");

  const activeSignProject = await getActiveSabsignProject();
  const setupComplete = !!(activeSignProject as any)?.sabsign?.setupComplete;

  if (pathname && !onKiosk) {
    if (!activeSignProject) {
      if (!onPicker) redirect("/sabsign/projects");
    } else if (!setupComplete) {
      if (!onSetup) redirect("/sabsign/setup");
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

  return (
    <RBACGuard>
      <ProjectProvider initialProjects={projects} user={user}>
        <SabsignShell
          user={{
            name: user?.name,
            email: user?.email,
            avatar: user?.image,
          }}
          plan={{
            name: user?.plan?.name,
            credits: totalCredits,
          }}
          activeProjectId={activeSignProject ? String(activeSignProject._id) : null}
          activeProjectName={activeSignProject?.name ?? null}
          setupComplete={setupComplete}
        >
          {children}
        </SabsignShell>
      </ProjectProvider>
    </RBACGuard>
  );
}
