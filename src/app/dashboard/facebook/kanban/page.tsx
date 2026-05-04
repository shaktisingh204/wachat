"use client";

/**
 * /dashboard/facebook/kanban — Workflow kanban board (ZoruUI).
 *
 * Mirrors `src/app/wachat/_components/zoru-kanban-board.tsx` —
 * conversations grouped by status, status moves via per-row dropdown
 * (no drag-and-drop yet). Same server-action wiring as the legacy
 * `FacebookKanbanBoard`. Page chrome is a ZoruBreadcrumb +
 * ZoruPageHeader on top of the board.
 */

import * as React from "react";
import { Suspense } from "react";

import {
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSkeleton,
} from "@/components/zoruui";

import { ZoruFacebookKanbanBoard } from "../_components/zoru-facebook-kanban-board";

export default function FacebookKanbanPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="px-6 pt-6 pb-2">
        <ZoruBreadcrumb>
          <ZoruBreadcrumbList>
            <ZoruBreadcrumbItem>
              <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
            </ZoruBreadcrumbItem>
            <ZoruBreadcrumbSeparator />
            <ZoruBreadcrumbItem>
              <ZoruBreadcrumbLink href="/dashboard/facebook">
                Meta Suite
              </ZoruBreadcrumbLink>
            </ZoruBreadcrumbItem>
            <ZoruBreadcrumbSeparator />
            <ZoruBreadcrumbItem>
              <ZoruBreadcrumbPage>Kanban</ZoruBreadcrumbPage>
            </ZoruBreadcrumbItem>
          </ZoruBreadcrumbList>
        </ZoruBreadcrumb>

        <ZoruPageHeader bordered={false} className="mt-5 pb-3">
          <ZoruPageHeading>
            <ZoruPageTitle>Workflow kanban</ZoruPageTitle>
            <ZoruPageDescription>
              Move Messenger conversations between status columns. Status
              changes happen via the per-row dropdown — drag-reorder is
              coming soon.
            </ZoruPageDescription>
          </ZoruPageHeading>
        </ZoruPageHeader>
      </div>

      <div className="min-h-0 flex-1">
        <Suspense fallback={<ZoruSkeleton className="h-full w-full" />}>
          <ZoruFacebookKanbanBoard />
        </Suspense>
      </div>
    </div>
  );
}
