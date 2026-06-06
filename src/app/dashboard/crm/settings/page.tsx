import {
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Card,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
} from '@/components/sabcrm/20ui/compat';
import {
  getCrmSettings } from '@/app/actions/crm-settings.actions';
import { CrmSettingsForm } from '@/components/crm/settings/crm-settings-form';

export const dynamic = 'force-dynamic';

export default async function CrmSettingsPage() {
  const crmSettings = await getCrmSettings();

  return (
    <div className="flex min-h-full flex-col gap-6">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/crm">CRM</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Settings</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>CRM Settings</ZoruPageTitle>
          <ZoruPageDescription>
            Manage your organization profile, sales preferences, inventory configurations, and module features.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>

      {!crmSettings ? (
        <Card className="p-6">
          <p className="py-8 text-center text-[13px] text-[var(--st-text-secondary)]">
            Failed to load settings.
          </p>
        </Card>
      ) : (
        <CrmSettingsForm settings={crmSettings} />
      )}
    </div>
  );
}
