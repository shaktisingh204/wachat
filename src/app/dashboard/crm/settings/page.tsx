import { Settings } from 'lucide-react';

import { getCrmSettings } from '@/app/actions/crm-settings.actions';
import { CrmSettingsForm } from '@/components/crm/settings/crm-settings-form';
import { ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../_components/crm-page-header';

export const dynamic = 'force-dynamic';

export default async function CrmSettingsPage() {
  const crmSettings = await getCrmSettings();

  if (!crmSettings) {
    return (
      <ClayCard>
        <p className="py-8 text-center text-[13px] text-clay-ink-muted">
          Failed to load settings.
        </p>
      </ClayCard>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="CRM Settings"
        subtitle="Manage your organization profile, sales preferences, inventory configurations, and module features."
        icon={Settings}
      />

      <CrmSettingsForm settings={crmSettings} />
    </div>
  );
}
