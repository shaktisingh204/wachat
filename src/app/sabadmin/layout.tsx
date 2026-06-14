import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCachedSession } from "@/lib/server-cache";
import { RBACGuard } from "@/components/20ui-domain/rbac-guard";
import { getSabAdminContext } from "@/lib/sabadmin/tenant";

import { SabAdminShell } from "./_components/sabadmin-shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Center — SabNode",
  description:
    "Onboard employees in one flow: a company email + login, an Outlook-style mailbox, and access to the SabNode tools they need — Microsoft-365-style, all native.",
};

export default async function SabAdminLayout({
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

  // The Admin Center is the org owner's (and elevated admins') command center.
  const ctx = await getSabAdminContext();
  if (!ctx.ok) {
    redirect("/dashboard");
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
      <SabAdminShell
        user={{ name: user?.name, email: user?.email, avatar: user?.image }}
        plan={{ name: user?.plan?.name, credits: totalCredits }}
      >
        {children}
      </SabAdminShell>
    </RBACGuard>
  );
}
