'use client';

import { Settings } from 'lucide-react';
import { ClayCard } from '@/components/clay';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';

export default function SabChatSettingsPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Settings"
        subtitle="Configure general SabChat settings."
        icon={Settings}
      />
      <ClayCard>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 rounded-full bg-secondary p-4">
            <Settings className="h-10 w-10 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <h3 className="text-[16px] font-semibold text-foreground">Coming Soon</h3>
          <p className="mt-1 text-[13px] text-muted-foreground">Configure business hours, automated messages, and more.</p>
        </div>
      </ClayCard>
    </div>
  );
}
