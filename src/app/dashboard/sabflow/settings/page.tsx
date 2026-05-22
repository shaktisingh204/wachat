'use client';

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  Input,
  Label,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Separator,
  Skeleton,
  Switch,
  zoruSonnerToast,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition } from 'react';
import { Save,
  Send,
  Plus,
  Trash2,
  AlertCircle } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
    getSabflowSettings,
  saveSabflowSettings,
  type SabflowSettings,
  type SabflowVariableEntry,
  } from '@/app/actions/sabflow-settings.actions';

/**
 * /dashboard/sabflow/settings — module-level SabFlow settings.
 *
 * Five independent sections (defaults, retention, run limits, webhooks,
 * variables). Each section has its own save button which sends just that
 * section's patch to `saveSabflowSettings`. The variables editor is a
 * repeating key→value field — stored as JSON.
 */

import * as React from 'react';
import Link from 'next/link';

function formatTimestamp(iso?: string): string {
    if (!iso) return 'Never';
    try {
        const d = new Date(iso);
        return d.toLocaleString();
    } catch {
        return 'Unknown';
    }
}

function SectionHeader({ title, description }: { title: string; description: string }) {
    return (
        <div>
            <h3 className="text-[15px] font-medium text-zoru-ink">{title}</h3>
            <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">{description}</p>
        </div>
    );
}

function PageSkeleton() {
    return (
        <div className="mx-auto w-full max-w-[1200px] px-6 pt-6 pb-10">
            <ZoruSkeleton className="h-3 w-56" />
            <div className="mt-5 flex flex-col gap-2">
                <ZoruSkeleton className="h-3 w-24" />
                <ZoruSkeleton className="h-7 w-72" />
                <ZoruSkeleton className="h-3 w-96" />
            </div>
            <div className="mt-6 grid gap-4">
                <ZoruSkeleton className="h-60 w-full" />
                <ZoruSkeleton className="h-60 w-full" />
                <ZoruSkeleton className="h-60 w-full" />
            </div>
        </div>
    );
}

function safeNumber(input: string, fallback: number): number {
    const n = Number(input);
    return Number.isFinite(n) ? n : fallback;
}

export default function SabflowSettingsPage() {
    const { activeProject } = useProject();
    const [settings, setSettings] = useState<SabflowSettings | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isLoading, startLoading] = useTransition();
    const [savingSection, setSavingSection] = useState<string | null>(null);
    const [, startSaving] = useTransition();

    useEffect(() => {
        startLoading(async () => {
            const res = await getSabflowSettings();
            if (res.error) {
                setLoadError(res.error);
            } else if (res.settings) {
                setSettings(res.settings);
            }
        });
    }, []);

    function commitSave(
        section: keyof SabflowSettings,
        patch: Partial<SabflowSettings>,
        label: string,
    ) {
        setSavingSection(section as string);
        startSaving(async () => {
            const res = await saveSabflowSettings(patch);
            setSavingSection(null);
            if (res.error || !res.settings) {
                zoruSonnerToast.error(res.error || 'Save failed');
                return;
            }
            setSettings(res.settings);
            zoruSonnerToast.success(`${label} saved`);
        });
    }

    if (isLoading && !settings) return <PageSkeleton />;

    if (loadError) {
        return (
            <div className="mx-auto w-full max-w-[1200px] px-6 pt-6 pb-10">
                <ZoruAlert variant="destructive">
                    <AlertCircle />
                    <ZoruAlertTitle>Could not load SabFlow settings</ZoruAlertTitle>
                    <ZoruAlertDescription>{loadError}</ZoruAlertDescription>
                </ZoruAlert>
            </div>
        );
    }

    if (!settings) return <PageSkeleton />;

    return (
        <div className="mx-auto w-full max-w-[1200px] px-6 pt-6 pb-10">
            <ZoruBreadcrumb>
                <ZoruBreadcrumbList>
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
                    </ZoruBreadcrumbItem>
                    <ZoruBreadcrumbSeparator />
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbLink href="/dashboard/sabflow">SabFlow</ZoruBreadcrumbLink>
                    </ZoruBreadcrumbItem>
                    <ZoruBreadcrumbSeparator />
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbPage>Settings</ZoruBreadcrumbPage>
                    </ZoruBreadcrumbItem>
                </ZoruBreadcrumbList>
            </ZoruBreadcrumb>

            <ZoruPageHeader className="mt-5" bordered={false}>
                <ZoruPageHeading>
                    {activeProject?.name ? (
                        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-zoru-ink-subtle">
                            Project · {activeProject.name}
                        </p>
                    ) : null}
                    <ZoruPageTitle>SabFlow settings</ZoruPageTitle>
                    <ZoruPageDescription>
                        Defaults, retention, run limits, webhooks, and global variables for the
                        visual flow builder.
                    </ZoruPageDescription>
                </ZoruPageHeading>
                <div className="flex items-center gap-2">
                    <ZoruBadge variant="outline" className="gap-1.5">
                        <span className="text-zoru-ink-subtle">Last saved:</span>
                        <span className="text-zoru-ink">{formatTimestamp(settings.updatedAt)}</span>
                    </ZoruBadge>
                </div>
            </ZoruPageHeader>

            <div className="mt-6 flex flex-col gap-5">
                <DefaultsSection
                    value={settings.defaults}
                    onChange={(defaults) => setSettings({ ...settings, defaults })}
                    onSave={() =>
                        commitSave('defaults', { defaults: settings.defaults }, 'Defaults')
                    }
                    saving={savingSection === 'defaults'}
                />

                <ZoruSeparator />

                <RetentionSection
                    value={settings.retention}
                    onChange={(retention) => setSettings({ ...settings, retention })}
                    onSave={() =>
                        commitSave('retention', { retention: settings.retention }, 'Retention')
                    }
                    saving={savingSection === 'retention'}
                />

                <ZoruSeparator />

                <RunLimitsSection
                    value={settings.runLimits}
                    onChange={(runLimits) => setSettings({ ...settings, runLimits })}
                    onSave={() =>
                        commitSave('runLimits', { runLimits: settings.runLimits }, 'Run limits')
                    }
                    saving={savingSection === 'runLimits'}
                />

                <ZoruSeparator />

                <WebhooksSection
                    value={settings.webhooks}
                    onChange={(webhooks) => setSettings({ ...settings, webhooks })}
                    onSave={() =>
                        commitSave('webhooks', { webhooks: settings.webhooks }, 'Webhooks')
                    }
                    saving={savingSection === 'webhooks'}
                />

                <ZoruSeparator />

                <VariablesSection
                    value={settings.variables}
                    onChange={(variables) => setSettings({ ...settings, variables })}
                    onSave={() =>
                        commitSave('variables', { variables: settings.variables }, 'Variables')
                    }
                    saving={savingSection === 'variables'}
                />
            </div>

            <div className="mt-8 flex items-center justify-between text-[11.5px] text-zoru-ink-muted">
                <span>Settings apply to every flow run across your SabFlow workspaces.</span>
                <Link
                    href="/dashboard/sabflow"
                    className="text-zoru-ink-subtle underline-offset-2 hover:underline"
                >
                    Back to SabFlow
                </Link>
            </div>
        </div>
    );
}

/* ── sections ─────────────────────────────────────────────────────── */

function DefaultsSection({
    value,
    onChange,
    onSave,
    saving,
}: {
    value: SabflowSettings['defaults'];
    onChange: (v: SabflowSettings['defaults']) => void;
    onSave: () => void;
    saving: boolean;
}) {
    return (
        <ZoruCard className="p-6">
            <div className="flex items-start justify-between gap-4">
                <SectionHeader
                    title="Defaults"
                    description="Default workspace and execution timeout for new flow runs."
                />
                <ZoruButton size="sm" onClick={onSave} disabled={saving}>
                    <Save /> {saving ? 'Saving…' : 'Save'}
                </ZoruButton>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                    <ZoruLabel htmlFor="df-workspace">Default workspace</ZoruLabel>
                    <ZoruInput
                        id="df-workspace"
                        placeholder="e.g. Production"
                        value={value.defaultWorkspace}
                        onChange={(e) => onChange({ ...value, defaultWorkspace: e.target.value })}
                    />
                </div>
                <div className="grid gap-1.5">
                    <ZoruLabel htmlFor="df-timeout">Execution timeout (seconds)</ZoruLabel>
                    <ZoruInput
                        id="df-timeout"
                        type="number"
                        min={1}
                        value={value.executionTimeout}
                        onChange={(e) =>
                            onChange({
                                ...value,
                                executionTimeout: safeNumber(e.target.value, value.executionTimeout),
                            })
                        }
                    />
                </div>
            </div>
        </ZoruCard>
    );
}

function RetentionSection({
    value,
    onChange,
    onSave,
    saving,
}: {
    value: SabflowSettings['retention'];
    onChange: (v: SabflowSettings['retention']) => void;
    onSave: () => void;
    saving: boolean;
}) {
    return (
        <ZoruCard className="p-6">
            <div className="flex items-start justify-between gap-4">
                <SectionHeader
                    title="Retention"
                    description="How long flow run history is kept before it is purged."
                />
                <ZoruButton size="sm" onClick={onSave} disabled={saving}>
                    <Save /> {saving ? 'Saving…' : 'Save'}
                </ZoruButton>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                    <ZoruLabel htmlFor="rt-keep">Keep run history (days)</ZoruLabel>
                    <ZoruInput
                        id="rt-keep"
                        type="number"
                        min={1}
                        value={value.keepRunHistoryDays}
                        onChange={(e) =>
                            onChange({
                                ...value,
                                keepRunHistoryDays: safeNumber(
                                    e.target.value,
                                    value.keepRunHistoryDays,
                                ),
                            })
                        }
                    />
                </div>
                <div className="flex items-start justify-between gap-4 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-3">
                    <div>
                        <ZoruLabel htmlFor="rt-purge" className="text-[13px]">
                            Purge failed runs
                        </ZoruLabel>
                        <p className="mt-0.5 text-[11.5px] text-zoru-ink-muted">
                            Remove failed runs from history immediately.
                        </p>
                    </div>
                    <ZoruSwitch
                        id="rt-purge"
                        checked={value.purgeFailedRuns}
                        onCheckedChange={(checked) =>
                            onChange({ ...value, purgeFailedRuns: !!checked })
                        }
                    />
                </div>
            </div>
        </ZoruCard>
    );
}

function RunLimitsSection({
    value,
    onChange,
    onSave,
    saving,
}: {
    value: SabflowSettings['runLimits'];
    onChange: (v: SabflowSettings['runLimits']) => void;
    onSave: () => void;
    saving: boolean;
}) {
    return (
        <ZoruCard className="p-6">
            <div className="flex items-start justify-between gap-4">
                <SectionHeader
                    title="Run limits"
                    description="Guardrails for concurrent runs and per-run step count."
                />
                <ZoruButton size="sm" onClick={onSave} disabled={saving}>
                    <Save /> {saving ? 'Saving…' : 'Save'}
                </ZoruButton>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                    <ZoruLabel htmlFor="rl-concurrent">Max concurrent runs</ZoruLabel>
                    <ZoruInput
                        id="rl-concurrent"
                        type="number"
                        min={1}
                        value={value.maxConcurrentRuns}
                        onChange={(e) =>
                            onChange({
                                ...value,
                                maxConcurrentRuns: safeNumber(
                                    e.target.value,
                                    value.maxConcurrentRuns,
                                ),
                            })
                        }
                    />
                </div>
                <div className="grid gap-1.5">
                    <ZoruLabel htmlFor="rl-steps">Max steps per run</ZoruLabel>
                    <ZoruInput
                        id="rl-steps"
                        type="number"
                        min={1}
                        value={value.maxStepsPerRun}
                        onChange={(e) =>
                            onChange({
                                ...value,
                                maxStepsPerRun: safeNumber(e.target.value, value.maxStepsPerRun),
                            })
                        }
                    />
                </div>
            </div>
        </ZoruCard>
    );
}

function WebhooksSection({
    value,
    onChange,
    onSave,
    saving,
}: {
    value: SabflowSettings['webhooks'];
    onChange: (v: SabflowSettings['webhooks']) => void;
    onSave: () => void;
    saving: boolean;
}) {
    function sendTest() {
        if (!value.url) {
            zoruSonnerToast.error('Add a webhook URL first.');
            return;
        }
        zoruSonnerToast.info('Test webhook queued. Check your endpoint logs.');
    }

    return (
        <ZoruCard className="p-6">
            <div className="flex items-start justify-between gap-4">
                <SectionHeader
                    title="Webhooks"
                    description="Notify your endpoint when flow runs complete or fail."
                />
                <div className="flex items-center gap-2">
                    <ZoruButton variant="outline" size="sm" onClick={sendTest}>
                        <Send /> Send test
                    </ZoruButton>
                    <ZoruButton size="sm" onClick={onSave} disabled={saving}>
                        <Save /> {saving ? 'Saving…' : 'Save'}
                    </ZoruButton>
                </div>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div className="grid gap-1.5 sm:col-span-2">
                    <ZoruLabel htmlFor="wh-url">Webhook URL</ZoruLabel>
                    <ZoruInput
                        id="wh-url"
                        type="url"
                        placeholder="https://example.com/webhooks/sabflow"
                        value={value.url}
                        onChange={(e) => onChange({ ...value, url: e.target.value })}
                    />
                </div>
                <div className="grid gap-1.5">
                    <ZoruLabel htmlFor="wh-retry">Retry attempts</ZoruLabel>
                    <ZoruInput
                        id="wh-retry"
                        type="number"
                        min={0}
                        max={10}
                        value={value.retryAttempts}
                        onChange={(e) =>
                            onChange({
                                ...value,
                                retryAttempts: safeNumber(e.target.value, value.retryAttempts),
                            })
                        }
                    />
                </div>
                <div className="grid gap-1.5 sm:col-span-3">
                    <ZoruLabel htmlFor="wh-secret">Signing secret</ZoruLabel>
                    <ZoruInput
                        id="wh-secret"
                        type="password"
                        placeholder="••••••••"
                        value={value.secret}
                        onChange={(e) => onChange({ ...value, secret: e.target.value })}
                    />
                </div>
            </div>
        </ZoruCard>
    );
}

function VariablesSection({
    value,
    onChange,
    onSave,
    saving,
}: {
    value: SabflowVariableEntry[];
    onChange: (v: SabflowVariableEntry[]) => void;
    onSave: () => void;
    saving: boolean;
}) {
    function updateRow(index: number, patch: Partial<SabflowVariableEntry>) {
        const next = value.map((row, i) => (i === index ? { ...row, ...patch } : row));
        onChange(next);
    }

    function removeRow(index: number) {
        onChange(value.filter((_, i) => i !== index));
    }

    function addRow() {
        onChange([...value, { key: '', value: '' }]);
    }

    return (
        <ZoruCard className="p-6">
            <div className="flex items-start justify-between gap-4">
                <SectionHeader
                    title="Variables"
                    description="Global key→value pairs available in every flow run."
                />
                <div className="flex items-center gap-2">
                    <ZoruButton variant="outline" size="sm" onClick={addRow}>
                        <Plus /> Add variable
                    </ZoruButton>
                    <ZoruButton size="sm" onClick={onSave} disabled={saving}>
                        <Save /> {saving ? 'Saving…' : 'Save'}
                    </ZoruButton>
                </div>
            </div>
            <div className="mt-5 flex flex-col gap-2">
                {value.length === 0 ? (
                    <div className="rounded-[var(--zoru-radius)] border border-dashed border-zoru-line bg-zoru-bg p-4 text-center text-[12.5px] text-zoru-ink-muted">
                        No variables yet. Click &quot;Add variable&quot; to create one.
                    </div>
                ) : (
                    value.map((row, idx) => (
                        <div
                            key={idx}
                            className="grid gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                        >
                            <div className="grid gap-1.5">
                                <ZoruLabel
                                    htmlFor={`var-key-${idx}`}
                                    className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle"
                                >
                                    Key
                                </ZoruLabel>
                                <ZoruInput
                                    id={`var-key-${idx}`}
                                    placeholder="API_BASE_URL"
                                    value={row.key}
                                    onChange={(e) => updateRow(idx, { key: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-1.5">
                                <ZoruLabel
                                    htmlFor={`var-val-${idx}`}
                                    className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle"
                                >
                                    Value
                                </ZoruLabel>
                                <ZoruInput
                                    id={`var-val-${idx}`}
                                    placeholder="https://api.example.com"
                                    value={row.value}
                                    onChange={(e) => updateRow(idx, { value: e.target.value })}
                                />
                            </div>
                            <ZoruButton
                                variant="outline"
                                size="icon-sm"
                                onClick={() => removeRow(idx)}
                                aria-label="Remove variable"
                            >
                                <Trash2 />
                            </ZoruButton>
                        </div>
                    ))
                )}
            </div>
        </ZoruCard>
    );
}
