/**
 * /dashboard/sabflow/logs — coming-soon stub.
 *
 * Rebuilt on ZoruUI primitives. Will surface a global execution log
 * across every flow with filters by status, node and time window.
 */

import { ScrollText } from "lucide-react";

import {
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruEmptyState,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
} from "@/components/zoruui";

export const metadata = {
  title: "SabFlow Logs · SabNode",
};

export default function Page() {
  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/sabflow/flow-builder">
              SabFlow
            </ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Logs</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Execution logs</ZoruPageTitle>
          <ZoruPageDescription>
            Cross-flow event stream with status, latency and node-level breakdowns.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </ZoruPageHeader>

      <ZoruEmptyState
        icon={<ScrollText />}
        title="Logs are coming soon"
        description="Filterable execution history across every flow will land here. Per-flow run history is already available from each flow's Results tab."
      />
    </div>
  );
}
