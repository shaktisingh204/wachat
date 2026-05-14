/**
 * /sabwa layout — Phase 0 of the SabWa (Personal WhatsApp) module.
 *
 * Mirrors the auth/project guard used by `/wachat/layout.tsx` (session check,
 * onboarding redirect, project provider) but renders a SabWa-specific
 * two-column shell:
 *
 *   ┌────────────────────────────────────────────────┐
 *   │ <SabWaSubRail />  │  {children}                │
 *   │ (md+: collapsible │                            │
 *   │  icon rail;       │                            │
 *   │  <md: hamburger   │                            │
 *   │  → <Sheet> drawer)│                            │
 *   └────────────────────────────────────────────────┘
 *
 * Per-phase work (1–13) only touches the page content; this shell is the
 * constant.
 */

import * as React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCachedSession, getCachedProjects } from "@/lib/server-cache";
import { RBACGuard } from "@/components/wabasimplify/rbac-guard";
import { ProjectProvider } from "@/context/project-context";

import { SabWaSubRail } from "./_components/sabwa-sub-rail";
import { SessionSwitcher } from "./_components/session-switcher";

export const metadata: Metadata = {
  title: "SabWa — Personal WhatsApp",
  description:
    "Connect your personal WhatsApp via Linked Devices and operate chats, groups, broadcasts, scheduling, automation, and AI from SabNode.",
};

export default async function SabWaLayout({
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

  return (
    <RBACGuard>
      <ProjectProvider initialProjects={projects} user={user}>
        <div className="flex min-h-screen w-full bg-background">
          {/* Left: collapsible sub-rail (mobile drawer via Sheet inside) */}
          <SabWaSubRail />

          {/* Right: page content with a sticky session switcher header */}
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b bg-background/80 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-6">
              <div className="md:hidden">
                {/* Hamburger is rendered by SabWaSubRail itself */}
              </div>
              <div className="ml-auto">
                <SessionSwitcher />
              </div>
            </header>
            <main className="min-w-0 flex-1">{children}</main>
          </div>
        </div>
      </ProjectProvider>
    </RBACGuard>
  );
}
