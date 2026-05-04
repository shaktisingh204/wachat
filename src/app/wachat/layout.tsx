/**
 * /wachat layout — phase 0 of the wachat → ZoruUI migration.
 *
 * Reuses `ZoruHomeShell` so every wachat page renders inside the
 * SAME sidebar + dock as `/dashboard`. No bespoke wachat chrome.
 * Sidebar groups (Workspace / Shortcuts) and the bottom-anchored
 * dock are inherited unchanged. The "WaChat" dock entry highlights
 * automatically when `pathname` starts with `/wachat`.
 *
 * Per-phase work (1–9) only touches the page content; this layout
 * is the constant.
 */

import "@/styles/zoruui.css";

import React from "react";
import { redirect } from "next/navigation";

import { getSession } from "@/app/actions/user.actions";
import { getProjects } from "@/app/actions/project.actions";
import { RBACGuard } from "@/components/wabasimplify/rbac-guard";
import { ZoruHomeShell } from "@/components/zoruui";

export default async function WachatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }

  const user = session.user as any;

  const onboarding = user.onboarding;
  if (onboarding && onboarding.status !== "complete") {
    redirect("/onboarding");
  }
  if (!onboarding || onboarding.status !== "complete") {
    const projects = await getProjects();
    if (!projects || projects.length === 0) {
      redirect("/onboarding");
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
    </RBACGuard>
  );
}
