import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { getCachedSession, getCachedProjects } from "@/lib/server-cache";
import { getActiveSabHrmProject } from "@/lib/sabhrm/workspace";
import { RBACGuard } from "@/components/20ui-domain/rbac-guard";
import { ProjectProvider } from "@/context/project-context";

import { SabHrmShell } from "./_components/sabhrm-shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SabHRM — HR, Payroll & People",
  description:
    "The people platform: employees, org structure, attendance, leave, payroll, performance, and self-service — one source of truth for your team.",
};

export default async function SabHrmLayout({
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

  /* ── SabHRM gate: organization → mandatory setup → use ─────────────────
   * The selected HR org lives in the `sabhrm_project` cookie (server-
   * readable, unlike the client-only `activeProjectId`). The current path is
   * read from the `x-url` header the proxy sets on `/sabhrm/*`.
   *   • no org selected             → /sabhrm/projects (picker)
   *   • selected but setup pending  → /sabhrm/setup     (wizard)
   * `/sabhrm/projects` + `/sabhrm/setup` are always allowed through. */
  const pathname = (await headers()).get("x-url") ?? "";
  const onPicker =
    pathname === "/sabhrm/projects" || pathname.startsWith("/sabhrm/projects/");
  const onSetup =
    pathname === "/sabhrm/setup" || pathname.startsWith("/sabhrm/setup/");

  const activeProject = await getActiveSabHrmProject();
  const setupComplete = !!activeProject?.sabhrm?.setupComplete;

  if (pathname) {
    if (!activeProject) {
      if (!onPicker) redirect("/sabhrm/projects");
    } else if (!setupComplete) {
      if (!onSetup) redirect("/sabhrm/setup");
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
        <SabHrmShell
          user={{
            name: user?.name,
            email: user?.email,
            avatar: user?.image,
          }}
          plan={{
            name: user?.plan?.name,
            credits: totalCredits,
          }}
          activeProjectId={activeProject ? String(activeProject._id) : null}
          activeProjectName={activeProject?.name ?? null}
          setupComplete={setupComplete}
        >
          {children}
        </SabHrmShell>
      </ProjectProvider>
    </RBACGuard>
  );
}
