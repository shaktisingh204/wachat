export const dynamic = 'force-dynamic';

/**
 * /wachat layout — now on the new `DashboardShell` (landing-aligned
 * light theme, per-module accent identity, no ZoruUI chrome). The
 * shell auto-resolves the Wachat sidebar from the pathname.
 *
 * Still wraps everything in RBACGuard + ProjectProvider so the project
 * context is available to every page in the module.
 */

import "@/styles/zoruui.css";

import React from "react";
import { redirect } from "next/navigation";

import { getCachedSession, getCachedProjects } from "@/lib/server-cache";
import { RBACGuard } from "@/components/zoruui-domain/rbac-guard";
import { ProjectProvider } from "@/context/project-context";

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
        <WachatShell
          user={{
            name: user?.name,
            email: user?.email,
            avatar: user?.image,
            role: user?.role,
          }}
          plan={{
            name: user?.plan?.name,
            credits: totalCredits,
          }}
        >
          {children}
        </WachatShell>
      </ProjectProvider>
    </RBACGuard>
  );
}
