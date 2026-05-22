"use client";

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
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
 * `@/components/wabasimplify`.
 */

function WidgetSkeleton() {
  return <ZoruSkeleton className="h-[600px] w-full" />;
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
            <ZoruBreadcrumbPage>Widget</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Widget</ZoruPageTitle>
          <ZoruPageDescription>
            Configure and embed the SabChat widget on your website.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </ZoruPageHeader>

      {isLoading ? (
        <WidgetSkeleton />
      ) : !user ? (
        <ZoruAlert variant="destructive">
          <MessageCircle />
          <ZoruAlertTitle>Not signed in</ZoruAlertTitle>
          <ZoruAlertDescription>
            You must be logged in to configure the chat widget.
          </ZoruAlertDescription>
        </ZoruAlert>
      ) : (
        <ZoruSabChatWidgetGenerator user={user} />
      )}
    </div>
  );
}
