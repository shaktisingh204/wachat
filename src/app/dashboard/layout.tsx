/**
 * /home layout — first route migrated to ZoruUI.
 *
 * Server Component: checks session, redirects unauthenticated users,
 * then wraps children in `ZoruHomeShell` (zoruui rail + sidebar +
 * header + dock). The multi-tab `TabsProvider`/`TabsBar` system is
 * intentionally absent — see ZORUUI_TASKS.md, hard constraint.
 */

import "@/styles/zoruui.css";

import React from "react";
import { redirect } from "next/navigation";

import { getSession } from "@/app/actions/user.actions";
import { getProjects } from "@/app/actions/project.actions";
import { RBACGuard } from "@/components/wabasimplify/rbac-guard";
import { ZoruHomeShell } from "@/components/zoruui";

export default async function HomeLayout({
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
