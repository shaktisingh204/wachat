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
          <div className="mb-4 rounded-full bg-clay-surface-2 p-4">
            <Settings className="h-10 w-10 text-clay-ink-muted" strokeWidth={1.5} />
          </div>
          <h3 className="text-[16px] font-semibold text-clay-ink">Coming Soon</h3>
          <p className="mt-1 text-[13px] text-clay-ink-muted">Configure business hours, automated messages, and more.</p>
        </div>
      </ClayCard>
    </div>
  );
}
