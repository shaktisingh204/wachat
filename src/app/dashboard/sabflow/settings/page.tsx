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
    testSabflowWebhook,
    type SabflowSettings,
    type SabflowVariableEntry,
} from '@/app/actions/sabflow-settings.actions';
import { sabflowSettingsSchema } from '@/app/actions/sabflow-settings.schema';
import type { z } from 'zod';
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
import { fmtDate } from '@/lib/utils';

function formatTimestamp(iso?: string): string {
    if (!iso) return 'Never';
    return fmtDate(iso);
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
            <Skeleton className="h-3 w-56" />
            <div className="mt-5 flex flex-col gap-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-72" />
                <Skeleton className="h-3 w-96" />
            </div>
            <div className="mt-6 grid gap-4">
                <Skeleton className="h-60 w-full" />
                <Skeleton className="h-60 w-full" />
                <Skeleton className="h-60 w-full" />
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

    const parsedSettings = settings ? sabflowSettingsSchema.safeParse(settings) : null;
    const validationIssues = parsedSettings && !parsedSettings.success ? parsedSettings.error.issues : [];

    function getError(path: (string | number)[]) {
        return validationIssues.find((i) => 
            i.path.length === path.length && i.path.every((p, idx) => p === path[idx])
        )?.message;
    }

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
        const parseResult = sabflowSettingsSchema.safeParse(patch);
        if (!parseResult.success) {
            zoruSonnerToast.error(parseResult.error.errors[0].message);
            return;
        }

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

    function saveAll() {
        if (!settings) return;

        const patch = {
            defaults: settings.defaults,
            retention: settings.retention,
            runLimits: settings.runLimits,
            webhooks: settings.webhooks,
            variables: settings.variables,
        };

        const parseResult = sabflowSettingsSchema.safeParse(patch);
        if (!parseResult.success) {
            zoruSonnerToast.error(parseResult.error.errors[0].message);
            return;
        }

        setSavingSection('all');
        startSaving(async () => {
            const res = await saveSabflowSettings(patch);
            setSavingSection(null);
            if (res.error || !res.settings) {
                zoruSonnerToast.error(res.error || 'Save failed');
                return;
            }
            setSettings(res.settings);
            zoruSonnerToast.success('All settings saved');
        });
    }

    if (isLoading && !settings) return <PageSkeleton />;

    if (loadError) {
        return (
            <div className="mx-auto w-full max-w-[1200px] px-6 pt-6 pb-10">
                <Alert variant="destructive">
                    <AlertCircle />
                    <ZoruAlertTitle>Could not load SabFlow settings</ZoruAlertTitle>
                    <ZoruAlertDescription>{loadError}</ZoruAlertDescription>
                </Alert>
            </div>
        );
    }

    if (!settings) return <PageSkeleton />;

    return (
        <div className="mx-auto w-full max-w-[1200px] px-6 pt-6 pb-10">
            <Breadcrumb>
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
            </Breadcrumb>

            <PageHeader className="mt-5" bordered={false}>
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
                <div className="flex items-center gap-3">
                    <Badge variant="outline" className="gap-1.5 h-[32px] px-3">
                        <span className="text-zoru-ink-subtle">Last saved:</span>
                        <span className="text-zoru-ink font-medium">{formatTimestamp(settings.updatedAt)}</span>
                    </Badge>
                    <Button size="sm" onClick={saveAll} disabled={savingSection === 'all'}>
                        <Save /> {savingSection === 'all' ? 'Saving…' : 'Save all'}
                    </Button>
                </div>
            </PageHeader>

            <div className="mt-6 flex flex-col gap-5">
                <DefaultsSection
                    value={settings.defaults}
                    onChange={(defaults) => setSettings({ ...settings, defaults })}
                    onSave={() =>
                        commitSave('defaults', { defaults: settings.defaults }, 'Defaults')
                    }
                    saving={savingSection === 'defaults'}
                    getError={(path) => getError(['defaults', ...path])}
                />

                <Separator />

                <RetentionSection
                    value={settings.retention}
                    onChange={(retention) => setSettings({ ...settings, retention })}
                    onSave={() =>
                        commitSave('retention', { retention: settings.retention }, 'Retention')
                    }
                    saving={savingSection === 'retention'}
                    getError={(path) => getError(['retention', ...path])}
                />

                <Separator />

                <RunLimitsSection
                    value={settings.runLimits}
                    onChange={(runLimits) => setSettings({ ...settings, runLimits })}
                    onSave={() =>
                        commitSave('runLimits', { runLimits: settings.runLimits }, 'Run limits')
                    }
                    saving={savingSection === 'runLimits'}
                    getError={(path) => getError(['runLimits', ...path])}
                />

                <Separator />

                <WebhooksSection
                    value={settings.webhooks}
                    onChange={(webhooks) => setSettings({ ...settings, webhooks })}
                    onSave={() =>
                        commitSave('webhooks', { webhooks: settings.webhooks }, 'Webhooks')
                    }
                    saving={savingSection === 'webhooks'}
                    getError={(path) => getError(['webhooks', ...path])}
                />

                <Separator />

                <VariablesSection
                    value={settings.variables}
                    onChange={(variables) => setSettings({ ...settings, variables })}
                    onSave={() =>
                        commitSave('variables', { variables: settings.variables }, 'Variables')
                    }
                    saving={savingSection === 'variables'}
                    getError={(path) => getError(['variables', ...path])}
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
    getError,
}: {
    value: SabflowSettings['defaults'];
    onChange: (v: SabflowSettings['defaults']) => void;
    onSave: () => void;
    saving: boolean;
    getError: (path: (string | number)[]) => string | undefined;
}) {
    return (
        <Card className="p-6">
            <div className="flex items-start justify-between gap-4">
                <SectionHeader
                    title="Defaults"
                    description="Default workspace and execution timeout for new flow runs."
                />
                <Button size="sm" onClick={onSave} disabled={saving}>
                    <Save /> {saving ? 'Saving…' : 'Save'}
                </Button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                    <Label htmlFor="df-workspace">Default workspace</Label>
                    <Input
                        id="df-workspace"
                        placeholder="e.g. Production"
                        value={value.defaultWorkspace}
                        onChange={(e) => onChange({ ...value, defaultWorkspace: e.target.value })}
                    />
                </div>
                <div className="grid gap-1.5">
                    <Label htmlFor="df-timeout">Execution timeout (seconds)</Label>
                    <Input
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
                        className={getError(['executionTimeout']) ? 'border-red-500 focus-visible:ring-red-500' : ''}
                    />
                    {getError(['executionTimeout']) && (
                        <p className="text-[11.5px] text-red-500">{getError(['executionTimeout'])}</p>
                    )}
                </div>
            </div>
        </Card>
    );
}

function RetentionSection({
    value,
    onChange,
    onSave,
    saving,
    getError,
}: {
    value: SabflowSettings['retention'];
    onChange: (v: SabflowSettings['retention']) => void;
    onSave: () => void;
    saving: boolean;
    getError: (path: (string | number)[]) => string | undefined;
}) {
    return (
        <Card className="p-6">
            <div className="flex items-start justify-between gap-4">
                <SectionHeader
                    title="Retention"
                    description="How long flow run history is kept before it is purged."
                />
                <Button size="sm" onClick={onSave} disabled={saving}>
                    <Save /> {saving ? 'Saving…' : 'Save'}
                </Button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                    <Label htmlFor="rt-keep">Keep run history (days)</Label>
                    <Input
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
                        className={getError(['keepRunHistoryDays']) ? 'border-red-500 focus-visible:ring-red-500' : ''}
                    />
                    {getError(['keepRunHistoryDays']) && (
                        <p className="text-[11.5px] text-red-500">{getError(['keepRunHistoryDays'])}</p>
                    )}
                </div>
                <div className="flex items-start justify-between gap-4 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-3">
                    <div>
                        <Label htmlFor="rt-purge" className="text-[13px]">
                            Purge failed runs
                        </Label>
                        <p className="mt-0.5 text-[11.5px] text-zoru-ink-muted">
                            Remove failed runs from history immediately.
                        </p>
                    </div>
                    <Switch
                        id="rt-purge"
                        checked={value.purgeFailedRuns}
                        onCheckedChange={(checked) =>
                            onChange({ ...value, purgeFailedRuns: !!checked })
                        }
                    />
                </div>
            </div>
        </Card>
    );
}

function RunLimitsSection({
    value,
    onChange,
    onSave,
    saving,
    getError,
}: {
    value: SabflowSettings['runLimits'];
    onChange: (v: SabflowSettings['runLimits']) => void;
    onSave: () => void;
    saving: boolean;
    getError: (path: (string | number)[]) => string | undefined;
}) {
    return (
        <Card className="p-6">
            <div className="flex items-start justify-between gap-4">
                <SectionHeader
                    title="Run limits"
                    description="Guardrails for concurrent runs and per-run step count."
                />
                <Button size="sm" onClick={onSave} disabled={saving}>
                    <Save /> {saving ? 'Saving…' : 'Save'}
                </Button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                    <Label htmlFor="rl-concurrent">Max concurrent runs</Label>
                    <Input
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
                        className={getError(['maxConcurrentRuns']) ? 'border-red-500 focus-visible:ring-red-500' : ''}
                    />
                    {getError(['maxConcurrentRuns']) && (
                        <p className="text-[11.5px] text-red-500">{getError(['maxConcurrentRuns'])}</p>
                    )}
                </div>
                <div className="grid gap-1.5">
                    <Label htmlFor="rl-steps">Max steps per run</Label>
                    <Input
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
                        className={getError(['maxStepsPerRun']) ? 'border-red-500 focus-visible:ring-red-500' : ''}
                    />
                    {getError(['maxStepsPerRun']) && (
                        <p className="text-[11.5px] text-red-500">{getError(['maxStepsPerRun'])}</p>
                    )}
                </div>
            </div>
        </Card>
    );
}

function WebhooksSection({
    value,
    onChange,
    onSave,
    saving,
    getError,
}: {
    value: SabflowSettings['webhooks'];
    onChange: (v: SabflowSettings['webhooks']) => void;
    onSave: () => void;
    saving: boolean;
    getError: (path: (string | number)[]) => string | undefined;
}) {
    const [isTesting, startTesting] = useTransition();

    function sendTest() {
        if (!value.url) {
            zoruSonnerToast.error('Add a webhook URL first.');
            return;
        }

        startTesting(async () => {
            zoruSonnerToast.loading('Testing webhook...', { id: 'webhook-test' });
            const res = await testSabflowWebhook(value.url, value.secret);
            if (res.error) {
                zoruSonnerToast.error(`Test failed: ${res.error}`, { id: 'webhook-test' });
            } else {
                zoruSonnerToast.success('Test webhook sent successfully.', { id: 'webhook-test' });
            }
        });
    }

    return (
        <Card className="p-6">
            <div className="flex items-start justify-between gap-4">
                <SectionHeader
                    title="Webhooks"
                    description="Notify your endpoint when flow runs complete or fail."
                />
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={sendTest} disabled={isTesting}>
                        <Send /> {isTesting ? 'Sending...' : 'Send test'}
                    </Button>
                    <Button size="sm" onClick={onSave} disabled={saving}>
                        <Save /> {saving ? 'Saving…' : 'Save'}
                    </Button>
                </div>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div className="grid gap-1.5 sm:col-span-2">
                    <Label htmlFor="wh-url">Webhook URL</Label>
                    <Input
                        id="wh-url"
                        type="url"
                        placeholder="https://example.com/webhooks/sabflow"
                        value={value.url}
                        onChange={(e) => onChange({ ...value, url: e.target.value })}
                        className={getError(['url']) ? 'border-red-500 focus-visible:ring-red-500' : ''}
                    />
                    {getError(['url']) && (
                        <p className="text-[11.5px] text-red-500">{getError(['url'])}</p>
                    )}
                </div>
                <div className="grid gap-1.5">
                    <Label htmlFor="wh-retry">Retry attempts</Label>
                    <Input
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
                        className={getError(['retryAttempts']) ? 'border-red-500 focus-visible:ring-red-500' : ''}
                    />
                    {getError(['retryAttempts']) && (
                        <p className="text-[11.5px] text-red-500">{getError(['retryAttempts'])}</p>
                    )}
                </div>
                <div className="grid gap-1.5 sm:col-span-3">
                    <Label htmlFor="wh-secret">Signing secret</Label>
                    <Input
                        id="wh-secret"
                        type="password"
                        placeholder="••••••••"
                        value={value.secret}
                        onChange={(e) => onChange({ ...value, secret: e.target.value })}
                    />
                </div>
            </div>
        </Card>
    );
}

function VariablesSection({
    value,
    onChange,
    onSave,
    saving,
    getError,
}: {
    value: SabflowVariableEntry[];
    onChange: (v: SabflowVariableEntry[]) => void;
    onSave: () => void;
    saving: boolean;
    getError: (path: (string | number)[]) => string | undefined;
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
        <Card className="p-6">
            <div className="flex items-start justify-between gap-4">
                <SectionHeader
                    title="Variables"
                    description="Global key→value pairs available in every flow run."
                />
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={addRow}>
                        <Plus /> Add variable
                    </Button>
                    <Button size="sm" onClick={onSave} disabled={saving}>
                        <Save /> {saving ? 'Saving…' : 'Save'}
                    </Button>
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
                                <Label
                                    htmlFor={`var-key-${idx}`}
                                    className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle"
                                >
                                    Key
                                </Label>
                                <Input
                                    id={`var-key-${idx}`}
                                    placeholder="API_BASE_URL"
                                    value={row.key}
                                    onChange={(e) => updateRow(idx, { key: e.target.value })}
                                    className={getError([idx, 'key']) ? 'border-red-500 focus-visible:ring-red-500' : ''}
                                />
                                {getError([idx, 'key']) && (
                                    <p className="text-[11.5px] text-red-500">{getError([idx, 'key'])}</p>
                                )}
                            </div>
                            <div className="grid gap-1.5">
                                <Label
                                    htmlFor={`var-val-${idx}`}
                                    className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle"
                                >
                                    Value
                                </Label>
                                <Input
                                    id={`var-val-${idx}`}
                                    placeholder="https://api.example.com"
                                    value={row.value}
                                    onChange={(e) => updateRow(idx, { value: e.target.value })}
                                    className={getError([idx, 'value']) ? 'border-red-500 focus-visible:ring-red-500' : ''}
                                />
                                {getError([idx, 'value']) && (
                                    <p className="text-[11.5px] text-red-500">{getError([idx, 'value'])}</p>
                                )}
                            </div>
                            <Button
                                variant="outline"
                                size="icon-sm"
                                onClick={() => removeRow(idx)}
                                aria-label="Remove variable"
                            >
                                <Trash2 />
                            </Button>
                        </div>
                    ))
                )}
            </div>
        </Card>
    );
}
