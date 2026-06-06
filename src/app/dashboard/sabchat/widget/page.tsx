"use client";

import { Alert, AlertDescription, AlertTitle, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, PageDescription, PageHeader, PageHeading, PageTitle, Skeleton } from '@/components/sabcrm/20ui';
import { ZoruSabChatWidgetGenerator } from '../_components/zoru-sabchat-widget-generator';
import {
  useEffect,
  useState } from "react";
import { MessageCircle } from "lucide-react";

import { getSession } from "@/app/actions/user.actions";
import type { WithId,
  User } from "@/lib/definitions";

/**
 * /dashboard/sabchat/widget — widget configuration & embed code.
 *
 * Same `getSession` flow. Visual layer fully Zoru — delegates to local
 * `ZoruSabChatWidgetGenerator` to avoid pulling visual primitives from
 * `@/components/zoruui-domain`.
 */

function WidgetSkeleton() {
  return <Skeleton className="h-[600px] w-full" />;
}

export default function SabChatWidgetPage() {
  const [user, setUser] = useState<WithId<User> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getSession().then((session) => {
      setUser((session?.user as WithId<User>) ?? null);
      setIsLoading(false);
    });
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
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
            <BreadcrumbPage>Widget</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <PageHeading>
          <PageTitle>Widget</PageTitle>
          <PageDescription>
            Configure and embed the SabChat widget on your website.
          </PageDescription>
        </PageHeading>
      </PageHeader>

      {isLoading ? (
        <WidgetSkeleton />
      ) : !user ? (
        <Alert variant="destructive">
          <MessageCircle />
          <AlertTitle>Not signed in</AlertTitle>
          <AlertDescription>
            You must be logged in to configure the chat widget.
          </AlertDescription>
        </Alert>
      ) : (
        <ZoruSabChatWidgetGenerator user={user} />
      )}
    </div>
  );
}
