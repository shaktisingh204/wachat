"use client";

import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, PageDescription, PageHeader, PageHeading, PageTitle, Skeleton } from '@/components/sabcrm/20ui/compat';
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
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard/facebook">
                Meta Suite
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Kanban</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <PageHeader bordered={false} className="mt-5 pb-3">
          <PageHeading>
            <PageTitle>Workflow kanban</PageTitle>
            <PageDescription>
              Move Messenger conversations between status columns. Status
              changes happen via the per-row dropdown — drag-reorder is
              coming soon.
            </PageDescription>
          </PageHeading>
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
