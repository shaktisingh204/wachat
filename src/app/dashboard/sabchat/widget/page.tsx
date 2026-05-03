'use client';

import { getSession } from '@/app/actions/user.actions';
import { SabChatWidgetGenerator } from '@/components/wabasimplify/sabchat-widget-generator';
import { ClayCard } from '@/components/clay';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { MessageCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

function PageSkeleton() {
  return (
    <ClayCard>
      <div className="animate-pulse h-96 rounded-lg bg-border" />
    </ClayCard>
  );
}

export default function SabChatWidgetPage() {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getSession().then(session => {
      setUser(session?.user);
      setIsLoading(false);
    });
  }, []);

  if (isLoading) {
    return (
      <div className="flex w-full flex-col gap-6">
        <CrmPageHeader
          title="Widget"
          subtitle="Configure and embed the SabChat widget on your website"
          icon={MessageCircle}
        />
        <PageSkeleton />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex w-full flex-col gap-6">
        <CrmPageHeader
          title="Widget"
          subtitle="Configure and embed the SabChat widget on your website"
          icon={MessageCircle}
        />
        <ClayCard>
          <p className="text-[13px] text-destructive">You must be logged in to configure the chat widget.</p>
        </ClayCard>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Widget"
        subtitle="Configure and embed the SabChat widget on your website"
        icon={MessageCircle}
      />
      <SabChatWidgetGenerator user={user} />
    </div>
  );
}
