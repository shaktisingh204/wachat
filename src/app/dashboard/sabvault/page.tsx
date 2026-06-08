"use client";

import React from "react";
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
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
    PageActions,
    Tooltip,
    TooltipProvider,
    TooltipTrigger,
    TooltipContent,
    type BadgeTone,
} from "@/components/sabcrm/20ui";
import { Plus, Key, KeyRound, ShieldCheck, RotateCw, Settings, Copy } from "lucide-react";

interface Secret {
    id: string;
    name: string;
    environment: string;
    lastModified: string;
    status: string;
    type: string;
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

export default function SabVaultSecretsPage() {
    const secrets: Secret[] = [
        { id: "1", name: "Production Database URL", environment: "Production", lastModified: "2026-06-01", status: "Active", type: "Database" },
        { id: "2", name: "Staging API Key", environment: "Staging", lastModified: "2026-05-28", status: "Active", type: "API Key" },
        { id: "3", name: "Legacy System Password", environment: "Legacy", lastModified: "2025-12-15", status: "Rotated", type: "Password" },
        { id: "4", name: "AWS Root Credentials", environment: "Production", lastModified: "2026-06-03", status: "Active", type: "Cloud" },
    ];

    const total = secrets.length;
    const active = secrets.filter((s) => s.status === "Active").length;
    const rotated = secrets.filter((s) => s.status === "Rotated").length;
    const production = secrets.filter((s) => s.environment === "Production").length;

    return (
        <div className="20ui p-6 space-y-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>Secrets</PageTitle>
                    <PageDescription>
                        Manage your enterprise secrets, passwords, and API keys securely.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Button variant="primary" iconLeft={Plus}>
                        New Secret
                    </Button>
                </PageActions>
            </PageHeader>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Total secrets" value={total} icon={Key} />
                <StatCard label="Active" value={active} icon={ShieldCheck} accent="var(--st-success)" />
                <StatCard label="Awaiting rotation" value={rotated} icon={RotateCw} accent="var(--st-warn)" />
                <StatCard label="Production" value={production} icon={KeyRound} accent="var(--st-accent)" />
            </div>

            <Card padding="none">
                <CardHeader>
                    <CardTitle>Vault Secrets</CardTitle>
                    <CardDescription>
                        Every secret stored in this workspace, with its environment and rotation status.
                    </CardDescription>
                </CardHeader>
                <CardBody>
                    {secrets.length === 0 ? (
                        <EmptyState
                            icon={Key}
                            title="No secrets yet"
                            description="Store your first password or API key to keep credentials out of plaintext."
                            action={
                                <Button variant="primary" iconLeft={Plus}>
                                    New Secret
                                </Button>
                            }
                        />
                    ) : (
                        <TooltipProvider>
                            <Table>
                                <THead>
                                    <Tr>
                                        <Th>Name</Th>
                                        <Th>Environment</Th>
                                        <Th>Type</Th>
                                        <Th>Last Modified</Th>
                                        <Th>Status</Th>
                                        <Th align="right">Actions</Th>
                                    </Tr>
                                </THead>
                                <TBody>
                                    {secrets.map((secret) => (
                                        <Tr key={secret.id}>
                                            <Td>
                                                <span className="flex items-center gap-2 font-medium text-[var(--st-text)]">
                                                    <Key
                                                        className="h-4 w-4 text-[var(--st-text-tertiary)]"
                                                        aria-hidden="true"
                                                    />
                                                    {secret.name}
                                                </span>
                                            </Td>
                                            <Td>
                                                <Badge tone={ENV_TONE[secret.environment] ?? "neutral"} kind="outline">
                                                    {secret.environment}
                                                </Badge>
                                            </Td>
                                            <Td>
                                                <span className="text-[var(--st-text-secondary)]">{secret.type}</span>
                                            </Td>
                                            <Td>
                                                <span className="text-[var(--st-text-secondary)]">{secret.lastModified}</span>
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
                                                            <IconButton label="Copy secret" icon={Copy} />
                                                        </TooltipTrigger>
                                                        <TooltipContent>Copy secret</TooltipContent>
                                                    </Tooltip>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <IconButton label="Secret settings" icon={Settings} />
                                                        </TooltipTrigger>
                                                        <TooltipContent>Secret settings</TooltipContent>
                                                    </Tooltip>
                                                </span>
                                            </Td>
                                        </Tr>
                                    ))}
                                </TBody>
                            </Table>
                        </TooltipProvider>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}
