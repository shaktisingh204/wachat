import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { getCachedSession, getCachedProjects } from "@/lib/server-cache";
import { getActiveSabchatProject } from "@/lib/sabchat/workspace";
import { RBACGuard } from "@/components/20ui-domain/rbac-guard";
import { ProjectProvider } from "@/context/project-context";

import { SabchatShell } from "./_components/sabchat-shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SabChat — Live chat & support",
  description:
    "World-class live chat — an embeddable website widget, a real-time multi-agent inbox, AI deflection, and proactive messaging, isolated per project.",
};

export default async function SabchatLayout({
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

  /* -- SabChat gate: project → mandatory setup → use ---------------------
   * The selected chat project lives in the `sabchat_project` cookie (server-
   * readable, unlike the client-only `activeProjectId`). The current path is
   * read from the `x-url` header the proxy sets on `/sabchat/*`.
   *   • no project selected            → /sabchat/projects (picker)
   *   • selected but setup incomplete  → /sabchat/setup     (wizard)
   * `/sabchat/projects` + `/sabchat/setup` are always allowed through.
   * `SabchatShell` carries a client-side backstop for the rare case where
   * `x-url` is unavailable (pathname empty → no server redirect here). */
  const pathname = (await headers()).get("x-url") ?? "";
  const onPicker =
    pathname === "/sabchat/projects" ||
    pathname.startsWith("/sabchat/projects/");
  const onSetup =
    pathname === "/sabchat/setup" || pathname.startsWith("/sabchat/setup/");

  const activeChatProject = await getActiveSabchatProject();
  const setupComplete = !!activeChatProject?.sabchat?.setupComplete;

  if (pathname) {
    if (!activeChatProject) {
      if (!onPicker) redirect("/sabchat/projects");
    } else if (!setupComplete) {
      if (!onSetup) redirect("/sabchat/setup");
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

  const engineUrl = process.env.RUST_API_URL ?? "http://localhost:8080";

  return (
    <RBACGuard>
      <ProjectProvider initialProjects={projects} user={user}>
        <SabchatShell
          user={{
            name: user?.name,
            email: user?.email,
            avatar: user?.image,
          }}
          plan={{
            name: user?.plan?.name,
            credits: totalCredits,
          }}
          engineUrl={engineUrl}
          activeProjectId={
            activeChatProject ? String(activeChatProject._id) : null
          }
          activeProjectName={activeChatProject?.name ?? null}
          setupComplete={setupComplete}
        >
          {children}
        </SabchatShell>
      </ProjectProvider>
    </RBACGuard>
  );
}
