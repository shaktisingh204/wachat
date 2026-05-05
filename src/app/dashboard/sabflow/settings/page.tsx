/**
 * /dashboard/sabflow/settings — coming-soon stub.
 *
 * Rebuilt on ZoruUI primitives (no clay, no `@/components/ui/*`).
 * Will eventually surface flow-wide defaults: branding, retention,
 * webhook secrets, and per-project access policies.
 */

import { Settings } from "lucide-react";

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
  title: "SabFlow Settings · SabNode",
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
            <ZoruBreadcrumbPage>Settings</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Settings</ZoruPageTitle>
          <ZoruPageDescription>
            Configure flow-wide defaults, retention windows and webhook secrets.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </ZoruPageHeader>

      <ZoruEmptyState
        icon={<Settings />}
        title="Settings are coming soon"
        description="Branding, default retention, webhook signing keys and per-project access policies will land here. Until then, open an individual flow's editor to tweak its own settings."
      />
    </div>
  );
}
