
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { getCachedSession, getCachedProjects } from "@/lib/server-cache";
import { getActiveSabcallProject } from "@/lib/sabcall/workspace";
import { RBACGuard } from "@/components/20ui-domain/rbac-guard";
import { ProjectProvider } from "@/context/project-context";

import { SabcallShell } from "./_components/sabcall-shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SabCall — Cloud PBX & calling",
  description:
    "Programmable voice, IVR, queues, voicemail, DIDs and an agent dashboard — a self-hosted calling platform with per-project isolation.",
};

export default async function SabCallLayout({
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

  /* ── SabCall gate: project → mandatory setup → use ─────────────────────
   * The selected call project lives in the `sabcall_project` cookie (server-
   * readable, unlike the client-only `activeProjectId`). The current path is
   * read from the `x-url` header the proxy sets on `/sabcall/*`.
   *   • no project selected            → /sabcall/projects (picker)
   *   • selected but setup incomplete  → /sabcall/setup     (wizard)
   * `/sabcall/projects` + `/sabcall/setup` are always allowed through.
   * `SabcallShell` carries a client-side backstop for the rare case where
   * `x-url` is unavailable (pathname empty → no server redirect here). */
  const pathname = (await headers()).get("x-url") ?? "";
  const onPicker =
    pathname === "/sabcall/projects" || pathname.startsWith("/sabcall/projects/");
  const onSetup =
    pathname === "/sabcall/setup" || pathname.startsWith("/sabcall/setup/");

  const activeCallProject = await getActiveSabcallProject();
  const setupComplete = !!activeCallProject?.sabcall?.setupComplete;

  if (pathname) {
    if (!activeCallProject) {
      if (!onPicker) redirect("/sabcall/projects");
    } else if (!setupComplete) {
      if (!onSetup) redirect("/sabcall/setup");
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
    (process.env.SABCALL_ENABLED ?? "false").toLowerCase() === "true";
  const engineUrl = process.env.SABCALL_ENGINE_URL ?? "http://localhost:4005";

  return (
    <RBACGuard>
      <ProjectProvider initialProjects={projects} user={user}>
        <SabcallShell
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
          activeProjectId={activeCallProject ? String(activeCallProject._id) : null}
          activeProjectName={activeCallProject?.name ?? null}
          setupComplete={setupComplete}
        >
          {children}
        </SabcallShell>
      </ProjectProvider>
    </RBACGuard>
  );
}
