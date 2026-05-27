import { Suspense } from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getPayrollSettings } from '@/app/actions/crm-payroll-settings.actions';
import { PayrollSettingsForm } from './payroll-settings-form';
import { ExportSettingsButton } from './export-settings-button';
import { CollaborativeBadge } from './collaborative-badge';
import { SettingsErrorBoundary } from './components/settings-error-boundary';

export const dynamic = 'force-dynamic';

async function FormContent() {
  const settings = await getPayrollSettings();
  return <PayrollSettingsForm settings={settings} />;
}

async function HeaderActions() {
  const settings = await getPayrollSettings();
  return <ExportSettingsButton settings={settings} />;
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="h-64 bg-zoru-surface-muted rounded-xl w-full border border-zoru-line"></div>
      <div className="h-80 bg-zoru-surface-muted rounded-xl w-full border border-zoru-line"></div>
      <div className="h-40 bg-zoru-surface-muted rounded-xl w-full border border-zoru-line"></div>
    </div>
  );
}

function ErrorFallback() {
  return (
    <div className="p-6 border border-zoru-line bg-zoru-surface-2 text-zoru-ink rounded-xl text-center">
      <h3 className="font-semibold mb-2">Failed to load settings</h3>
      <p className="text-sm">Please refresh the page or try again later.</p>
    </div>
  );
}

export default function PayrollSettingsPage() {
  return (
    <EntityListShell
      title="Payroll Settings"
      subtitle="Configure pay cycle, statutory contributions, late-marking, approvals, and payslip template."
      primaryAction={
        <SettingsErrorBoundary fallback={<div className="w-[140px] h-10 bg-zoru-surface-muted animate-pulse rounded-md"></div>}>
          <Suspense fallback={<div className="w-[140px] h-10 bg-zoru-surface-muted animate-pulse rounded-md"></div>}>
            <HeaderActions />
          </Suspense>
        </SettingsErrorBoundary>
      }
      filters={<CollaborativeBadge />}
    >
      <SettingsErrorBoundary fallback={<ErrorFallback />}>
        <Suspense fallback={<LoadingSkeleton />}>
          <FormContent />
        </Suspense>
      </SettingsErrorBoundary>
    </EntityListShell>
  );
}
