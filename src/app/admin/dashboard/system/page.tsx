import { ShieldCheck, AlertTriangle, Zap, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { SubscribeAllButton } from '@/components/wabasimplify/subscribe-all-button';
import { RunCronJobsButton } from '@/components/wabasimplify/run-cron-jobs-button';
import { SyncLocalTemplatesButton } from '@/components/wabasimplify/sync-local-templates-button';
import { WebhookProcessingToggle } from '@/components/wabasimplify/webhook-processing-toggle';
import { DiwaliThemeToggle } from '@/components/wabasimplify/diwali-theme-toggle';
import { AppLogoForm } from '@/components/wabasimplify/admin-logo-form';

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
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-start gap-3">
                <div className={`mt-0.5 h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${warning ? 'bg-amber-100 border border-amber-200' : 'bg-slate-100 border border-slate-300'}`}>
                    <Icon className={`h-4 w-4 ${warning ? 'text-amber-600' : 'text-slate-700'}`} />
                </div>
                <div>
                    <h2 className="font-semibold text-slate-900">{title}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">{description}</p>
                </div>
            </div>
            <div className="px-6 py-5">
                {children}
            </div>
        </div>
    );
}

export default function SystemHealthPage() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900">System Health & Actions</h1>
                <p className="text-sm text-slate-500 mt-1">Administrative controls and system-wide tasks. Use with caution.</p>
            </div>

            {/* Warning banner */}
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-medium text-amber-300">Restricted Area</p>
                    <p className="text-xs text-amber-600/70 mt-0.5">
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
                        <Separator className="bg-slate-100" />
                        <DiwaliThemeToggle />
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
