"use client";

import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, PageDescription, PageHeader, PageHeading, PageTitle, Skeleton } from '@/components/sabcrm/20ui';
import { Ui20SabChatClient } from '../_components/ui20-sabchat-client';
import {
  Suspense } from "react";
import { Inbox } from "lucide-react";

/**
 * /dashboard/sabchat/inbox — live chat inbox.
 *
 * Visual layer fully Ui20. Same server actions as before — we delegate
 * to the local Ui20SabChatClient which preserves
 * `getChatSessionsForUser`, `getFullChatSession`, and
 * `postChatMessageAction` end-to-end.
 */

function InboxSkeleton() {
  return (
    <div className="flex h-[calc(100vh-220px)] w-full gap-3">
      <Skeleton className="h-full w-[320px] shrink-0" />
      <Skeleton className="h-full flex-1" />
    </div>
  );
}

export default function SabChatInboxPage() {
  return (
    <div className="mx-auto flex h-full w-full max-w-[1480px] flex-col gap-4 px-6 pt-6 pb-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/sabchat/inbox">
              SabChat
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Inbox</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <PageHeading>
          <PageTitle>Live chat inbox</PageTitle>
          <PageDescription>
            Reply to website visitors in real time.
          </PageDescription>
        </PageHeading>
      </PageHeader>

      <div className="min-h-0 flex-1">
        <Suspense fallback={<InboxSkeleton />}>
          <Ui20SabChatClient />
        </Suspense>
      </div>
    </div>
  );
}
