/**
 * /dashboard/sabflow/docs — coming-soon stub.
 *
 * Rebuilt on ZoruUI primitives. Will host inline product docs:
 * node reference, expression cheat-sheet, deploy/embed guides.
 */

import { BookOpen } from "lucide-react";

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
  title: "SabFlow Docs · SabNode",
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
            <ZoruBreadcrumbPage>Docs</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Documentation</ZoruPageTitle>
          <ZoruPageDescription>
            Inline product reference for builders working on SabFlow.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </ZoruPageHeader>

      <ZoruEmptyState
        icon={<BookOpen />}
        title="Docs are coming soon"
        description="Node reference, expression cheat-sheet, embed snippets and deployment guides will live here. For now, hover any node in the editor to see its inline help."
      />
    </div>
  );
}
