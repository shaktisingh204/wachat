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
} from '@/components/zoruui';
import { ZoruSabChatClient } from '../_components/zoru-sabchat-client';
import {
  Suspense } from "react";
import { Inbox } from "lucide-react";

/**
 * /dashboard/sabchat/inbox — live chat inbox.
 *
 * Visual layer fully Zoru. Same server actions as before — we delegate
 * to the local ZoruSabChatClient which preserves
 * `getChatSessionsForUser`, `getFullChatSession`, and
 * `postChatMessageAction` end-to-end.
 */

function InboxSkeleton() {
  return (
    <div className="flex h-[calc(100vh-220px)] w-full gap-3">
      <ZoruSkeleton className="h-full w-[320px] shrink-0" />
      <ZoruSkeleton className="h-full flex-1" />
    </div>
  );
}

export default function SabChatInboxPage() {
  return (
    <div className="mx-auto flex h-full w-full max-w-[1480px] flex-col gap-4 px-6 pt-6 pb-4">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/sabchat/inbox">
              SabChat
            </ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Inbox</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Live chat inbox</ZoruPageTitle>
          <ZoruPageDescription>
            Reply to website visitors in real time.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </ZoruPageHeader>

      <div className="min-h-0 flex-1">
        <Suspense fallback={<InboxSkeleton />}>
          <ZoruSabChatClient />
        </Suspense>
      </div>
    </div>
  );
}
