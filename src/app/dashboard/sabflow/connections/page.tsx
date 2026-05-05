/**
 * /dashboard/sabflow/connections — coming-soon stub.
 *
 * Rebuilt on ZoruUI primitives. Will surface third-party credentials
 * shared across flows (HTTP auth, sheet exports, CRM tokens).
 */

import { Plug } from "lucide-react";

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
  title: "SabFlow Connections · SabNode",
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
            <ZoruBreadcrumbPage>Connections</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Connections</ZoruPageTitle>
          <ZoruPageDescription>
            Reusable credentials shared across every flow in this project.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </ZoruPageHeader>

      <ZoruEmptyState
        icon={<Plug />}
        title="Connections are coming soon"
        description="HTTP basic-auth, OAuth tokens, Google Sheets exports and CRM keys will be managed here. Today, configure credentials inline within each node."
      />
    </div>
  );
}
