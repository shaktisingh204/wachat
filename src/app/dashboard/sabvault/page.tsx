"use client";

import React from "react";
import Link from "next/link";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardBody,
    Button,
    IconButton,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
    Badge,
    StatCard,
    EmptyState,
    Progress,
    SegmentedControl,
    Separator,
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageDescription,
    PageActions,
    Tooltip,
    TooltipProvider,
    TooltipTrigger,
    TooltipContent,
    type BadgeTone,
} from "@/components/sabcrm/20ui";
import {
    Plus,
    KeyRound,
    ShieldCheck,
    RotateCw,
    Settings,
    Copy,
    Lock,
    Eye,
    ShieldAlert,
    Activity,
    Share2,
    Database,
    Cloud,
    LockKeyhole,
} from "lucide-react";

/** Accent hex values for StatCard chips (StatCard accent must be hex, never a token var). */
const ACCENT = {
    brand: "#3b7af5",
    success: "#1f9d55",
    warn: "#d68a1e",
    danger: "#e0484e",
} as const;

interface Secret {
    id: string;
    name: string;
    environment: "Production" | "Staging" | "Legacy";
    lastModified: string;
    status: "Active" | "Rotated";
    type: string;
    strength: number; // 0..100
}

const STATUS_TONE: Record<string, BadgeTone> = {
    Active: "success",
    Rotated: "warning",
};

const ENV_TONE: Record<string, BadgeTone> = {
    Production: "accent",
    Staging: "info",
    Legacy: "neutral",
};

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = {
    Database: Database,
    "API Key": KeyRound,
    Password: LockKeyhole,
    Cloud: Cloud,
};

function strengthTone(v: number): "danger" | "warning" | "success" {
    if (v < 45) return "danger";
    if (v < 75) return "warning";
    return "success";
}

export default function SabVaultSecretsPage() {
    const secrets: Secret[] = [
        { id: "1", name: "Production database URL", environment: "Production", lastModified: "Jun 1, 2026", status: "Active", type: "Database", strength: 88 },
        { id: "2", name: "Staging API key", environment: "Staging", lastModified: "May 28, 2026", status: "Active", type: "API Key", strength: 72 },
        { id: "3", name: "Legacy system password", environment: "Legacy", lastModified: "Dec 15, 2025", status: "Rotated", type: "Password", strength: 34 },
        { id: "4", name: "AWS root credentials", environment: "Production", lastModified: "Jun 3, 2026", status: "Active", type: "Cloud", strength: 94 },
    ];

    const [env, setEnv] = React.useState<string>("all");
    const filtered = env === "all" ? secrets : secrets.filter((s) => s.environment === env);

    const total = secrets.length;
    const active = secrets.filter((s) => s.status === "Active").length;
    const rotated = secrets.filter((s) => s.status === "Rotated").length;
    const production = secrets.filter((s) => s.environment === "Production").length;
    const healthScore = Math.round(
        secrets.reduce((sum, s) => sum + s.strength, 0) / Math.max(1, secrets.length),
    );

    return (
        <TooltipProvider>
            <main className="20ui mx-auto flex max-w-6xl flex-col gap-6 p-6">
                <PageHeader>
                    <PageHeaderHeading>
                        <PageEyebrow>SabVault</PageEyebrow>
                        <PageTitle>Secrets</PageTitle>
                        <PageDescription>
                            Store passwords, API keys, and credentials encrypted in your browser. Plaintext never reaches the server.
                        </PageDescription>
                    </PageHeaderHeading>
                    <PageActions>
                        <Link href="/dashboard/sabvault/unlock">
                            <Button variant="outline" iconLeft={Lock}>
                                Unlock vault
                            </Button>
                        </Link>
                        <Button variant="primary" iconLeft={Plus}>
                            New secret
                        </Button>
                    </PageActions>
                </PageHeader>

                <section
                    aria-label="Vault summary"
                    className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
                >
                    <StatCard label="Total secrets" value={total} icon={KeyRound} accent={ACCENT.brand} />
                    <StatCard
                        label="Active"
                        value={active}
                        icon={ShieldCheck}
                        accent={ACCENT.success}
                        delta={{ value: `${production} in production`, tone: "up" }}
                    />
                    <StatCard
                        label="Awaiting rotation"
                        value={rotated}
                        icon={RotateCw}
                        accent={ACCENT.warn}
                    />
                    <StatCard
                        label="Health score"
                        value={`${healthScore}%`}
                        icon={Activity}
                        accent={healthScore >= 75 ? ACCENT.success : ACCENT.warn}
                        delta={{
                            value: healthScore >= 75 ? "Strong overall" : "Needs attention",
                            tone: healthScore >= 75 ? "up" : "down",
                        }}
                    />
                </section>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_18rem]">
                    <Card padding="none">
                        <CardHeader>
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <KeyRound className="h-4 w-4 text-[var(--st-accent)]" aria-hidden="true" />
                                        Vault secrets
                                    </CardTitle>
                                    <CardDescription>
                                        Every credential stored in this workspace, with environment and rotation status.
                                    </CardDescription>
                                </div>
                                <SegmentedControl
                                    aria-label="Filter by environment"
                                    value={env}
                                    onChange={setEnv}
                                    size="sm"
                                    items={[
                                        { value: "all", label: "All" },
                                        { value: "Production", label: "Production" },
                                        { value: "Staging", label: "Staging" },
                                        { value: "Legacy", label: "Legacy" },
                                    ]}
                                />
                            </div>
                        </CardHeader>
                        <CardBody>
                            {filtered.length === 0 ? (
                                <EmptyState
                                    icon={KeyRound}
                                    title="No secrets here"
                                    description="No credentials match this environment yet. Add one to keep it out of plaintext."
                                    action={
                                        <Button variant="primary" iconLeft={Plus}>
                                            New secret
                                        </Button>
                                    }
                                />
                            ) : (
                                <Table hover>
                                    <THead>
                                        <Tr>
                                            <Th>Name</Th>
                                            <Th>Environment</Th>
                                            <Th>Strength</Th>
                                            <Th>Last modified</Th>
                                            <Th>Status</Th>
                                            <Th align="right">Actions</Th>
                                        </Tr>
                                    </THead>
                                    <TBody>
                                        {filtered.map((secret) => {
                                            const TypeIcon = TYPE_ICON[secret.type] ?? KeyRound;
                                            return (
                                                <Tr key={secret.id}>
                                                    <Td>
                                                        <span className="flex items-center gap-2.5 font-medium text-[var(--st-text)]">
                                                            <span
                                                                className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)]"
                                                                aria-hidden="true"
                                                            >
                                                                <TypeIcon className="h-3.5 w-3.5 text-[var(--st-text-secondary)]" />
                                                            </span>
                                                            <span className="flex flex-col">
                                                                {secret.name}
                                                                <span className="text-xs font-normal text-[var(--st-text-tertiary)]">
                                                                    {secret.type}
                                                                </span>
                                                            </span>
                                                        </span>
                                                    </Td>
                                                    <Td>
                                                        <Badge tone={ENV_TONE[secret.environment] ?? "neutral"} kind="outline">
                                                            {secret.environment}
                                                        </Badge>
                                                    </Td>
                                                    <Td>
                                                        <div className="flex w-28 items-center gap-2">
                                                            <Progress
                                                                value={secret.strength}
                                                                tone={strengthTone(secret.strength)}
                                                                size="sm"
                                                            />
                                                            <span className="w-9 text-right text-xs tabular-nums text-[var(--st-text-secondary)]">
                                                                {secret.strength}%
                                                            </span>
                                                        </div>
                                                    </Td>
                                                    <Td>
                                                        <span className="text-[var(--st-text-secondary)] tabular-nums">
                                                            {secret.lastModified}
                                                        </span>
                                                    </Td>
                                                    <Td>
                                                        <Badge tone={STATUS_TONE[secret.status] ?? "neutral"} dot>
                                                            {secret.status}
                                                        </Badge>
                                                    </Td>
                                                    <Td align="right">
                                                        <span className="inline-flex items-center justify-end gap-1">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <IconButton label={`Copy ${secret.name}`} icon={Copy} variant="ghost" size="sm" />
                                                                </TooltipTrigger>
                                                                <TooltipContent>Copy secret</TooltipContent>
                                                            </Tooltip>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <IconButton label={`Settings for ${secret.name}`} icon={Settings} variant="ghost" size="sm" />
                                                                </TooltipTrigger>
                                                                <TooltipContent>Secret settings</TooltipContent>
                                                            </Tooltip>
                                                        </span>
                                                    </Td>
                                                </Tr>
                                            );
                                        })}
                                    </TBody>
                                </Table>
                            )}
                        </CardBody>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-sm">
                                <ShieldCheck className="h-4 w-4 text-[var(--st-success)]" aria-hidden="true" />
                                Security shortcuts
                            </CardTitle>
                            <CardDescription>Jump to the tools that keep your vault safe.</CardDescription>
                        </CardHeader>
                        <CardBody className="flex flex-col gap-1">
                            <ShortcutLink
                                href="/dashboard/sabvault/health"
                                icon={Activity}
                                label="Vault health"
                                hint="Weak, reused, expiring"
                            />
                            <Separator />
                            <ShortcutLink
                                href="/dashboard/sabvault/breach-alerts"
                                icon={ShieldAlert}
                                label="Breach alerts"
                                hint="Exposed credentials"
                            />
                            <Separator />
                            <ShortcutLink
                                href="/dashboard/sabvault/shares"
                                icon={Share2}
                                label="Shared secrets"
                                hint="Access windows and views"
                            />
                            <Separator />
                            <ShortcutLink
                                href="/dashboard/sabvault/audit"
                                icon={Eye}
                                label="Audit log"
                                hint="Reveals, copies, shares"
                            />
                        </CardBody>
                    </Card>
                </div>
            </main>
        </TooltipProvider>
    );
}

function ShortcutLink({
    href,
    icon: Icon,
    label,
    hint,
}: {
    href: string;
    icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
    label: string;
    hint: string;
}) {
    return (
        <Link
            href={href}
            className="group flex items-center gap-3 rounded-[var(--st-radius)] px-2 py-2 transition-colors hover:bg-[var(--st-bg-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)]"
        >
            <span
                className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)] transition-colors group-hover:text-[var(--st-accent)]"
                aria-hidden="true"
            >
                <Icon className="h-4 w-4" />
            </span>
            <span className="flex flex-1 flex-col">
                <span className="text-sm font-medium text-[var(--st-text)]">{label}</span>
                <span className="text-xs text-[var(--st-text-tertiary)]">{hint}</span>
            </span>
        </Link>
    );
}
