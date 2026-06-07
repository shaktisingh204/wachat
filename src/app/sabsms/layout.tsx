
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCachedSession, getCachedProjects } from "@/lib/server-cache";
import { RBACGuard } from "@/components/zoruui-domain/rbac-guard";
import { ProjectProvider } from "@/context/project-context";

import { SabsmsShell } from "./_components/sabsms-shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SabSMS — SMS / MMS / RCS",
  description:
    "Multi-provider SMS, MMS and RCS messaging — campaigns, drips, two-way inbox, compliance, and analytics baked in.",
};

export default async function SabSmsLayout({
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

  const engineEnabled =
    (process.env.SABSMS_ENABLED ?? "false").toLowerCase() === "true";
  const engineUrl =
    process.env.SABSMS_ENGINE_URL ?? "http://localhost:4002";

  return (
    <RBACGuard>
      <ProjectProvider initialProjects={projects} user={user}>
        <SabsmsShell
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
        >
          {children}
        </SabsmsShell>
      </ProjectProvider>
    </RBACGuard>
  );
}
