export const dynamic = 'force-dynamic';

/**
 * /wachat layout — phase 0 of the wachat → Ui20 migration.
 *
 * Reuses `Ui20HomeShell` so every wachat page renders inside the
 * SAME sidebar + dock as `/dashboard`. No bespoke wachat chrome.
 * Sidebar groups (Workspace / Shortcuts) and the bottom-anchored
 * dock are inherited unchanged. The "WaChat" dock entry highlights
 * automatically when `pathname` starts with `/wachat`.
 *
 * Per-phase work (1–9) only touches the page content; this layout
 * is the constant.
 */


import React from "react";
import { redirect } from "next/navigation";

import { getCachedSession, getCachedProjects } from "@/lib/server-cache";
import { RBACGuard } from "@/components/20ui-domain/rbac-guard";
import { ProjectProvider } from "@/context/project-context";
import { ToastProvider, Toaster } from "@/components/sabcrm/20ui";

import { WachatShell } from "./_components/wachat-shell";

export default async function WachatLayout({
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
        {/* 20ui toast context for every WaChat page. The 85+ pages/components
            ported to 20ui call its useToast(), which requires this provider in
            an ancestor; the Toaster viewport portals to <body> with the ui20
            class baked in, so toasts resolve their tokens anywhere. */}
        <ToastProvider>
          <WachatShell
            user={{
              name: user?.name,
              email: user?.email,
              avatar: user?.image,
            }}
            plan={{
              name: user?.plan?.name,
              credits: totalCredits,
            }}
          >
            {children}
          </WachatShell>
          <Toaster />
        </ToastProvider>
      </ProjectProvider>
    </RBACGuard>
  );
}
