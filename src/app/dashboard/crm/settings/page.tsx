import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Card, PageDescription, PageHeader, PageHeading, PageTitle } from '@/components/sabcrm/20ui/compat';
import {
  getCrmSettings } from '@/app/actions/crm-settings.actions';
import { CrmSettingsForm } from '@/components/crm/settings/crm-settings-form';

export const dynamic = 'force-dynamic';

export default async function CrmSettingsPage() {
  const crmSettings = await getCrmSettings();

  return (
    <div className="flex min-h-full flex-col gap-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/crm">CRM</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Settings</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <PageHeading>
          <PageTitle>CRM Settings</PageTitle>
          <PageDescription>
            Manage your organization profile, sales preferences, inventory configurations, and module features.
          </PageDescription>
        </PageHeading>
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
