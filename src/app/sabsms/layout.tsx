import "@/styles/zoruui.css";

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCachedSession } from "@/lib/server-cache";
import { RBACGuard } from "@/components/wabasimplify/rbac-guard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SabSMS — SMS / MMS / RCS",
  description:
    "Multi-provider SMS, MMS and RCS messaging — campaigns, drips, two-way inbox, and compliance baked in.",
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
  return (
    <RBACGuard>
      <div className="min-h-screen bg-slate-50">{children}</div>
    </RBACGuard>
  );
}
