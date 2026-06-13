import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { getCachedSession, getCachedProjects } from "@/lib/server-cache";
import { getActiveSabmailProject } from "@/lib/sabmail/workspace";
import { RBACGuard } from "@/components/20ui-domain/rbac-guard";
import { ProjectProvider } from "@/context/project-context";

import { SabmailShell } from "./_components/sabmail-shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SabMail — Email, reimagined",
  description:
    "A world-class web email client + sending platform — connected inbox, AI triage, threads, campaigns, automations, and deliverability in one place.",
};

export default async function SabMailLayout({
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

  /* ── SabMail gate: project → mandatory setup → use ────────────────────
   * The selected mail project lives in the `sabmail_project` cookie (server-
   * readable, unlike the client-only `activeProjectId`). The current path is
   * read from the `x-url` header the proxy sets on `/sabmail/*`.
   *   • no project selected            → /sabmail/projects (picker)
   *   • selected but setup incomplete  → /sabmail/setup     (wizard)
   * `/sabmail/projects` + `/sabmail/setup` are always allowed through.
   * `SabmailShell` carries a client-side backstop for the rare case where
   * `x-url` is unavailable. */
  const pathname = (await headers()).get("x-url") ?? "";
  const onPicker =
    pathname === "/sabmail/projects" || pathname.startsWith("/sabmail/projects/");
  const onSetup =
    pathname === "/sabmail/setup" || pathname.startsWith("/sabmail/setup/");

  const activeMailProject = await getActiveSabmailProject();
  const setupComplete = !!activeMailProject?.sabmail?.setupComplete;

  if (pathname) {
    if (!activeMailProject) {
      if (!onPicker) redirect("/sabmail/projects");
    } else if (!setupComplete) {
      if (!onSetup) redirect("/sabmail/setup");
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
    (process.env.SABMAIL_ENABLED ?? "false").toLowerCase() === "true";
  const engineUrl = process.env.SABMAIL_ENGINE_URL ?? "http://localhost:4003";

  return (
    <RBACGuard>
      <ProjectProvider initialProjects={projects} user={user}>
        <SabmailShell
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
          activeProjectId={activeMailProject ? String(activeMailProject._id) : null}
          activeProjectName={activeMailProject?.name ?? null}
          setupComplete={setupComplete}
        >
          {children}
        </SabmailShell>
      </ProjectProvider>
    </RBACGuard>
  );
}
