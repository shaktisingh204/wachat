/**
 * /dashboard/sabflow — root redirect.
 *
 * The SabFlow surface lives under `/dashboard/sabflow/flow-builder`.
 * Without this server-side redirect, hitting /dashboard/sabflow directly
 * 404s. The redirect keeps deep links and rail entries pointing at the
 * canonical landing page.
 */

import { redirect } from "next/navigation";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import {} from "@/components/zoruui";

export const dynamic = "force-dynamic";

export default function SabFlowIndexPage() {
  redirect("/dashboard/sabflow/flow-builder");
}
