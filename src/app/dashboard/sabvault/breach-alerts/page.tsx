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
    PageHeader,
    PageHeaderHeading,
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
} from "lucide-react";

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

    return (
        <TooltipProvider>
            <div className="ui20 p-6 space-y-6">
                <PageHeader>
                    <PageHeaderHeading>
                        <PageTitle>
                            <span className="inline-flex items-center gap-2">
                                <ShieldAlert className="h-5 w-5 text-[var(--st-danger)]" aria-hidden="true" />
                                Breach Alerts
                            </span>
                        </PageTitle>
                        <PageDescription>
                            Monitor leaked secrets and exposed credentials across public sources.
                        </PageDescription>
                    </PageHeaderHeading>
                    <PageActions>
                        <Button variant="danger" iconLeft={RadioTower}>
                            Scan Now
                        </Button>
                    </PageActions>
                </PageHeader>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <StatCard
                        label="Open alerts"
                        value={openCount}
                        icon={ShieldAlert}
                        accent="var(--st-danger)"
                    />
                    <StatCard
                        label="Critical severity"
                        value={criticalCount}
                        icon={AlertTriangle}
                        accent="var(--st-warn)"
                    />
                    <StatCard
                        label="Resolved"
                        value={resolvedCount}
                        icon={ShieldCheck}
                        accent="var(--st-success)"
                    />
                </div>

                <Card padding="none">
                    <CardHeader>
                        <CardTitle>Recent alerts</CardTitle>
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
            </div>
        </TooltipProvider>
    );
}
