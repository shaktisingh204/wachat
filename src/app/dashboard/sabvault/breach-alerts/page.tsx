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
    StatCard,
    Badge,
    EmptyState,
    Progress,
    Separator,
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageDescription,
    PageActions,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
    TooltipProvider,
    Tooltip,
    TooltipTrigger,
    TooltipContent,
    type BadgeTone,
} from "@/components/sabcrm/20ui";
import {
    ShieldAlert,
    AlertTriangle,
    CheckCircle,
    RadioTower,
    ShieldCheck,
    SearchCheck,
    Eye,
    Globe,
} from "lucide-react";

/** StatCard accent chips need hex values, never token vars. */
const ACCENT = {
    danger: "#e0484e",
    warn: "#d68a1e",
    success: "#1f9d55",
} as const;

type Severity = "Critical" | "High" | "Medium";
type Status = "Open" | "Investigating" | "Resolved";

interface BreachAlert {
    id: string;
    secretName: string;
    source: string;
    detectedAt: string;
    severity: Severity;
    status: Status;
}

const SEVERITY_TONE: Record<Severity, BadgeTone> = {
    Critical: "danger",
    High: "warning",
    Medium: "neutral",
};

const STATUS_TONE: Record<Status, BadgeTone> = {
    Open: "danger",
    Investigating: "info",
    Resolved: "success",
};

export default function SabVaultBreachAlertsPage() {
    const alerts: BreachAlert[] = [
        { id: "1", secretName: "Legacy System Password", source: "HaveIBeenPwned", detectedAt: "2026-06-03 10:15", severity: "High", status: "Open" },
        { id: "2", secretName: "Employee Portal User", source: "Dark Web Scan", detectedAt: "2026-06-02 08:30", severity: "Critical", status: "Investigating" },
        { id: "3", secretName: "Dev Database URL", source: "GitHub Leaks", detectedAt: "2026-05-20 14:00", severity: "Medium", status: "Resolved" },
    ];

    const openCount = alerts.filter((a) => a.status !== "Resolved").length;
    const criticalCount = alerts.filter((a) => a.severity === "Critical").length;
    const resolvedCount = alerts.filter((a) => a.status === "Resolved").length;
    const resolvedPct = alerts.length
        ? Math.round((resolvedCount / alerts.length) * 100)
        : 100;

    return (
        <TooltipProvider>
            <main className="20ui mx-auto flex max-w-6xl flex-col gap-6 p-6">
                <PageHeader>
                    <PageHeaderHeading>
                        <PageEyebrow>SabVault</PageEyebrow>
                        <PageTitle>Breach alerts</PageTitle>
                        <PageDescription>
                            Monitor leaked secrets and exposed credentials across public breach sources.
                        </PageDescription>
                    </PageHeaderHeading>
                    <PageActions>
                        <Button variant="danger" iconLeft={RadioTower}>
                            Scan now
                        </Button>
                    </PageActions>
                </PageHeader>

                <section
                    aria-label="Breach summary"
                    className="grid grid-cols-1 gap-4 sm:grid-cols-3"
                >
                    <StatCard
                        label="Open alerts"
                        value={openCount}
                        icon={ShieldAlert}
                        accent={ACCENT.danger}
                        delta={{
                            value: openCount > 0 ? "Action needed" : "All handled",
                            tone: openCount > 0 ? "down" : "up",
                        }}
                    />
                    <StatCard
                        label="Critical severity"
                        value={criticalCount}
                        icon={AlertTriangle}
                        accent={ACCENT.warn}
                    />
                    <StatCard
                        label="Resolved"
                        value={resolvedCount}
                        icon={ShieldCheck}
                        accent={ACCENT.success}
                        delta={{ value: `${resolvedPct}% of alerts`, tone: "neutral" }}
                    />
                </section>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-sm">
                            <ShieldCheck className="h-4 w-4 text-[var(--st-success)]" aria-hidden="true" />
                            Remediation progress
                        </CardTitle>
                        <CardDescription>
                            Share of flagged credentials that have been rotated or cleared.
                        </CardDescription>
                    </CardHeader>
                    <CardBody>
                        <div className="flex items-center gap-3">
                            <Progress value={resolvedPct} tone="success" className="flex-1" />
                            <span className="w-12 text-right text-sm font-medium tabular-nums text-[var(--st-text)]">
                                {resolvedPct}%
                            </span>
                        </div>
                        <Separator className="my-3" />
                        <p className="flex items-center gap-1.5 text-xs text-[var(--st-text-tertiary)]">
                            <Globe className="h-3.5 w-3.5" aria-hidden="true" />
                            Last scan ran Jun 3, 2026 at 10:15 against HaveIBeenPwned, dark web feeds, and public leaks.
                        </p>
                    </CardBody>
                </Card>

                <Card padding="none">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ShieldAlert className="h-4 w-4 text-[var(--st-danger)]" aria-hidden="true" />
                            Recent alerts
                        </CardTitle>
                        <CardDescription>
                            Credentials flagged as exposed, newest first.
                        </CardDescription>
                    </CardHeader>
                    <CardBody>
                        {alerts.length === 0 ? (
                            <EmptyState
                                icon={SearchCheck}
                                tone="success"
                                title="No breaches detected"
                                description="Your monitored secrets have not appeared in any known leak source. Run a scan to check again."
                                action={
                                    <Button variant="primary" iconLeft={RadioTower}>
                                        Scan Now
                                    </Button>
                                }
                            />
                        ) : (
                            <Table hover>
                                <THead>
                                    <Tr>
                                        <Th>Compromised secret</Th>
                                        <Th>Source</Th>
                                        <Th>Detected at</Th>
                                        <Th>Severity</Th>
                                        <Th>Status</Th>
                                        <Th align="right">Actions</Th>
                                    </Tr>
                                </THead>
                                <TBody>
                                    {alerts.map((alert) => (
                                        <Tr key={alert.id}>
                                            <Td>
                                                <span className="inline-flex items-center gap-2 font-medium text-[var(--st-text)]">
                                                    <AlertTriangle
                                                        className={
                                                            alert.severity === "Critical"
                                                                ? "h-4 w-4 text-[var(--st-danger)]"
                                                                : "h-4 w-4 text-[var(--st-warn)]"
                                                        }
                                                        aria-hidden="true"
                                                    />
                                                    {alert.secretName}
                                                </span>
                                            </Td>
                                            <Td>
                                                <span className="text-[var(--st-text-secondary)]">{alert.source}</span>
                                            </Td>
                                            <Td>
                                                <span className="text-[var(--st-text-secondary)] tabular-nums">{alert.detectedAt}</span>
                                            </Td>
                                            <Td>
                                                <Badge tone={SEVERITY_TONE[alert.severity]} dot>
                                                    {alert.severity}
                                                </Badge>
                                            </Td>
                                            <Td>
                                                <Badge tone={STATUS_TONE[alert.status]} kind="outline">
                                                    {alert.status}
                                                </Badge>
                                            </Td>
                                            <Td align="right">
                                                <span className="inline-flex items-center justify-end gap-1">
                                                    {alert.status !== "Resolved" ? (
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <IconButton
                                                                    label={`Mark "${alert.secretName}" resolved`}
                                                                    icon={CheckCircle}
                                                                    variant="ghost"
                                                                    size="sm"
                                                                />
                                                            </TooltipTrigger>
                                                            <TooltipContent>Mark resolved</TooltipContent>
                                                        </Tooltip>
                                                    ) : null}
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <IconButton
                                                                label={`View details for "${alert.secretName}"`}
                                                                icon={Eye}
                                                                variant="ghost"
                                                                size="sm"
                                                            />
                                                        </TooltipTrigger>
                                                        <TooltipContent>View details</TooltipContent>
                                                    </Tooltip>
                                                </span>
                                            </Td>
                                        </Tr>
                                    ))}
                                </TBody>
                            </Table>
                        )}
                    </CardBody>
                </Card>
            </main>
        </TooltipProvider>
    );
}
