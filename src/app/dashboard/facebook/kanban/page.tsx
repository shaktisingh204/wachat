"use client";

import {
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Skeleton,
} from '@/components/sabcrm/20ui/compat';
import { ZoruFacebookKanbanBoard } from '../_components/zoru-facebook-kanban-board';
import {
  Suspense } from "react";

/**
 * /dashboard/facebook/kanban — Workflow kanban board (ZoruUI).
 *
 * Mirrors `src/app/wachat/_components/zoru-kanban-board.tsx` —
 * conversations grouped by status, status moves via per-row dropdown
 * (no drag-and-drop yet). Same server-action wiring as the legacy
 * `FacebookKanbanBoard`. Page chrome is a Breadcrumb +
 * PageHeader on top of the board.
 */

import * as React from "react";

export default function FacebookKanbanPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="px-6 pt-6 pb-2">
        <Breadcrumb>
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
        </Breadcrumb>

        <PageHeader bordered={false} className="mt-5 pb-3">
          <ZoruPageHeading>
            <ZoruPageTitle>Workflow kanban</ZoruPageTitle>
            <ZoruPageDescription>
              Move Messenger conversations between status columns. Status
              changes happen via the per-row dropdown — drag-reorder is
              coming soon.
            </ZoruPageDescription>
          </ZoruPageHeading>
        </PageHeader>
      </div>

      <div className="min-h-0 flex-1">
        <Suspense fallback={<Skeleton className="h-full w-full" />}>
          <ZoruFacebookKanbanBoard />
        </Suspense>
      </div>
    </div>
  );
}
