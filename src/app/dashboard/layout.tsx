/**
 * /dashboard layout — the SabNode account dashboard, on ZoruUI.
 *
 * Server Component: checks session, redirects unauthenticated users,
 * then wraps children in `ZoruHomeShell` (zoruui sidebar + header +
 * bottom-anchored dock). The vertical app rail and the URL-synced
 * multi-tab strip are both intentionally absent.
 *
 * Sibling modules under /dashboard/{module}/ that ship their own
 * layout.tsx (sabflow, crm, seo, hrm, ad-manager, email, sms, …)
 * override this shell on their own subtrees.
 */

import "@/styles/zoruui.css";

import React from "react";
import { redirect } from "next/navigation";

import { getCachedSession, getCachedProjects } from "@/lib/server-cache";
import { RBACGuard } from "@/components/wabasimplify/rbac-guard";
import { ZoruHomeShell } from "@/components/zoruui";
import { ProjectProvider } from "@/context/project-context";

export default async function DashboardLayout({
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

  // Always fetch projects — both for the onboarding gate AND to seed
  // the ProjectProvider so every /dashboard/* page can call useProject()
  // without crashing.
  const projects = (await getCachedProjects()) || [];
  if (
    (!onboarding || onboarding.status !== "complete") &&
    projects.length === 0
  ) {
    redirect("/onboarding");
  }

  // session.user.credits is keyed by channel; collapse to a single
  // total for the sidebar plan-card readout.
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
        <ZoruHomeShell
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
        </ZoruHomeShell>
      </ProjectProvider>
    </RBACGuard>
  );
}
