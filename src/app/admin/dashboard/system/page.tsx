import { Card, Separator } from '@/components/sabcrm/20ui';
import { ShieldCheck, AlertTriangle, Zap, RefreshCw, Image as ImageIcon } from 'lucide-react';

import { SubscribeAllButton } from '@/components/zoruui-domain/subscribe-all-button';
import { RunCronJobsButton } from '@/components/zoruui-domain/run-cron-jobs-button';
import { SyncLocalTemplatesButton } from '@/components/zoruui-domain/sync-local-templates-button';
import { WebhookProcessingToggle } from '@/components/zoruui-domain/webhook-processing-toggle';
import { DiwaliThemeToggle } from '@/components/zoruui-domain/diwali-theme-toggle';
import { AppLogoForm } from '@/components/zoruui-domain/admin-logo-form';
import { SystemBackupButton } from '@/components/zoruui-domain/system-backup-button';
import { MaintenanceModeToggle } from '@/components/zoruui-domain/maintenance-mode-toggle';

export const dynamic = 'force-dynamic';

function SectionCard({
    title,
    description,
    icon: Icon,
    warning,
    children,
}: {
    title: string;
    description: string;
    icon: React.ElementType;
    warning?: boolean;
    children: React.ReactNode;
}) {
    return (
        <Card className="rounded-2xl border border-[var(--st-border)] bg-[var(--st-bg)] overflow-hidden p-0">
            <div className="px-6 py-4 border-b border-[var(--st-border)] flex items-start gap-3">
                <div className={`mt-0.5 h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${warning ? 'bg-[var(--st-bg-muted)] border border-[var(--st-border)]' : 'bg-[var(--st-bg-secondary)] border border-[var(--st-border)]'}`}>
                    <Icon className={`h-4 w-4 ${warning ? 'text-[var(--st-text)]' : 'text-[var(--st-text)]'}`} />
                </div>
                <div>
                    <h2 className="font-semibold text-[var(--st-text)]">{title}</h2>
                    <p className="text-xs text-[var(--st-text-secondary)] mt-0.5">{description}</p>
                </div>
            </div>
            <div className="px-6 py-5">
                {children}
            </div>
        </Card>
    );
}

export default function SystemHealthPage() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-[var(--st-text)]">System Health & Actions</h1>
                <p className="text-sm text-[var(--st-text-secondary)] mt-1">Administrative controls and system-wide tasks. Use with caution.</p>
            </div>

            {/* Warning banner */}
            <div className="flex items-start gap-3 rounded-2xl border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-5 py-4">
                <AlertTriangle className="h-5 w-5 text-[var(--st-text)] shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-medium text-[var(--st-text-secondary)]">Restricted Area</p>
                    <p className="text-xs text-[var(--st-text)]/70 mt-0.5">
                        Actions here affect the entire platform. All operations are logged.
                    </p>
                </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
                {/* Cron / Sync actions */}
                <SectionCard
                    title="System Controls"
                    description="Sync data, trigger scheduled jobs, and manage platform operations."
                    icon={Zap}
                    warning
                >
                    <div className="flex flex-wrap gap-2">
                        <SubscribeAllButton />
                        <RunCronJobsButton />
                        <SyncLocalTemplatesButton />
                        <SystemBackupButton />
                    </div>
                </SectionCard>

                {/* Toggles */}
                <SectionCard
                    title="Feature Toggles"
                    description="Enable or disable global system-wide features in real time."
                    icon={ShieldCheck}
                >
                    <div className="space-y-4">
                        <WebhookProcessingToggle />
                        <Separator className="bg-[var(--st-border)]" />
                        <DiwaliThemeToggle />
                        <Separator className="bg-[var(--st-border)]" />
                        <MaintenanceModeToggle />
                    </div>
                </SectionCard>

                {/* Logo */}
                <div className="lg:col-span-2">
                    <SectionCard
                        title="App Logo"
                        description="Upload a custom logo or provide a URL. Leave empty to restore the default SabNode logo."
                        icon={ImageIcon}
                    >
                        <AppLogoForm />
                    </SectionCard>
                </div>
            </div>
        </div>
    );
}
