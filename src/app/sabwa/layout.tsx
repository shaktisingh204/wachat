export const dynamic = 'force-dynamic';

/**
 * /sabwa layout — ZoruUI migration.
 *
 * Reuses `ZoruHomeShell` (via `SabwaShell`) so every `/sabwa/*` page
 * renders inside the SAME sidebar + dock as `/dashboard`. No bespoke
 * SabWa chrome. Auth/project guard mirrors `/wachat/layout.tsx`.
 *
 * SabWa-specific session state (linked WhatsApp numbers) is provided
 * via `SabwaSessionProvider`. The "active session" pill lives inside
 * the relevant page bodies, not the global header (each page can pick
 * the position that suits its layout).
 */

import "@/styles/zoruui.css";

import * as React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCachedSession, getCachedProjects } from "@/lib/server-cache";
import { RBACGuard } from "@/components/zoruui-domain/rbac-guard";
import { ProjectProvider } from "@/context/project-context";
import { listSessions } from "@/app/actions/sabwa.actions";
import {
  SabwaSessionProvider,
  toSessionInfo,
  type SabwaSessionInfo,
} from "@/lib/sabwa/session-context";
import type { SabwaSession } from "@/lib/sabwa/types";

import { SabwaShell } from "./_components/sabwa-shell";

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

  // Best-effort prefetch of the SabWa session list. `activeProjectId` is a
  // client-only signal (lives in localStorage); on the server we fall back
  // to the first available project so the provider has *something* to
  // hydrate with. The provider will refresh on mount if the client's
  // chosen project differs.
  const defaultProjectId = projects[0]?._id?.toString();
  let initialSessions: SabwaSessionInfo[] = [];
  if (defaultProjectId) {
    try {
      const res = await listSessions(defaultProjectId);
      if (res.ok) {
        initialSessions = (res.sessions ?? []).map((s) =>
          toSessionInfo(s as Partial<SabwaSession>),
        );
      }
    } catch {
      // Phase 1: `listSessions` throws NOT_IMPLEMENTED — degrade to empty.
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
        <SabwaSessionProvider initialSessions={initialSessions}>
          <SabwaShell
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
          </SabwaShell>
        </SabwaSessionProvider>
      </ProjectProvider>
    </RBACGuard>
  );
}
