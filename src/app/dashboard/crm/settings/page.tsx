
import { Settings } from 'lucide-react';
import { getCrmSettings } from '@/app/actions/crm-settings.actions';
import { CrmSettingsForm } from '@/components/crm/settings/crm-settings-form';

export const dynamic = 'force-dynamic';

export default async function CrmSettingsPage() {
    const crmSettings = await getCrmSettings();

    if (!crmSettings) return <div>Failed to load settings.</div>;

    return (
        <div className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Settings className="h-8 w-8 text-primary" /> CRM Settings</h1>
                <p className="text-muted-foreground mt-2">Manage your organization profile, sales preferences, inventory configurations, and module features.</p>
            </div>

            <CrmSettingsForm settings={crmSettings} />
        </div>
    );
}
