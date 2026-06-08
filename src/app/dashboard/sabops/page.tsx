import { Package, Send, Server, ShieldAlert } from "lucide-react";

import {
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    Dot,
    PageDescription,
    PageEyebrow,
    PageHeader,
    PageHeading,
    PageTitle,
    StatCard,
    type BadgeTone,
} from '@/components/sabcrm/20ui';
import {
    listSabopsAlerts,
    listSabopsEndpoints,
    listSabopsMdmCommands,
    listSabopsPatches,
} from "@/app/actions/sabops.actions";

export const dynamic = "force-dynamic";

function countBy<T, K extends string>(rows: T[], key: (r: T) => K): Record<K, number> {
    const out = {} as Record<K, number>;
    for (const r of rows) {
        const k = key(r);
        out[k] = (out[k] ?? 0) + 1;
    }
    return out;
}

const ENDPOINT_TONE: Record<string, BadgeTone> = {
    online: "success",
    offline: "danger",
    stale: "warning",
    disabled: "neutral",
};

const SEVERITY_TONE: Record<string, BadgeTone> = {
    critical: "danger",
    high: "warning",
    medium: "info",
    low: "neutral",
};

export default async function SabopsOverviewPage() {
    const [endpoints, alerts, patches, commands] = await Promise.all([
        listSabopsEndpoints({ limit: 100 }).catch(() => ({ items: [] as Array<{ status: string }> })),
        listSabopsAlerts({ state: "open", limit: 100 }).catch(() => ({
            items: [] as Array<{ severity: string }>,
        })),
        listSabopsPatches({ status: "available", limit: 100 }).catch(() => ({ items: [] })),
        listSabopsMdmCommands({ limit: 10 }).catch(() => ({ items: [] })),
    ]);

    const byStatus = countBy(endpoints.items as Array<{ status: string }>, (e) => e.status);
    const bySeverity = countBy(alerts.items as Array<{ severity: string }>, (a) => a.severity);

    return (
        <div className="flex flex-col gap-6">
            <PageHeader>
                <PageHeading>
                    <PageEyebrow>SabOps</PageEyebrow>
                    <PageTitle>Fleet overview</PageTitle>
                    <PageDescription>
                        Endpoint management, MDM, Active Directory, and patching across your fleet.
                    </PageDescription>
                </PageHeading>
            </PageHeader>

            <section
                aria-label="Fleet metrics"
                className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"
            >
                <StatCard
                    label="Online endpoints"
                    value={byStatus.online ?? 0}
                    icon={<Server className="size-4" />}
                    accent="#1f9d55"
                    delta={{ value: `${endpoints.items.length} total`, tone: "neutral" }}
                />
                <StatCard
                    label="Open alerts"
                    value={alerts.items.length}
                    icon={<ShieldAlert className="size-4" />}
                    accent="#e0484e"
                    delta={{
                        value: `${bySeverity.critical ?? 0} critical, ${bySeverity.high ?? 0} high`,
                        tone: (bySeverity.critical ?? 0) > 0 ? "down" : "neutral",
                    }}
                />
                <StatCard
                    label="Pending patches"
                    value={patches.items.length}
                    icon={<Package className="size-4" />}
                    accent="#d97706"
                    delta={{ value: "Severity-prioritized", tone: "neutral" }}
                />
                <StatCard
                    label="Recent MDM commands"
                    value={commands.items.length}
                    icon={<Send className="size-4" />}
                    accent="#3b7af5"
                    delta={{ value: "Last 10 issued", tone: "neutral" }}
                />
            </section>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card variant="outlined">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Server className="size-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                            Endpoints by status
                        </CardTitle>
                    </CardHeader>
                    <CardBody>
                        <ul className="grid grid-cols-2 gap-2 text-sm">
                            {(["online", "offline", "stale", "disabled"] as const).map((s) => (
                                <li
                                    key={s}
                                    className="flex items-center justify-between rounded-[var(--st-radius)] border border-[var(--st-border)] px-3 py-2"
                                >
                                    <span className="inline-flex items-center gap-2 capitalize text-[var(--st-text-secondary)]">
                                        <Dot tone={ENDPOINT_TONE[s]} />
                                        {s}
                                    </span>
                                    <span className="font-semibold tabular-nums text-[var(--st-text)]">
                                        {byStatus[s] ?? 0}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </CardBody>
                </Card>

                <Card variant="outlined">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ShieldAlert className="size-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                            Alerts by severity
                        </CardTitle>
                    </CardHeader>
                    <CardBody>
                        <ul className="grid grid-cols-2 gap-2 text-sm">
                            {(["critical", "high", "medium", "low"] as const).map((s) => (
                                <li
                                    key={s}
                                    className="flex items-center justify-between rounded-[var(--st-radius)] border border-[var(--st-border)] px-3 py-2"
                                >
                                    <span className="inline-flex items-center gap-2 capitalize text-[var(--st-text-secondary)]">
                                        <Dot tone={SEVERITY_TONE[s]} />
                                        {s}
                                    </span>
                                    <span className="font-semibold tabular-nums text-[var(--st-text)]">
                                        {bySeverity[s] ?? 0}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </CardBody>
                </Card>
            </div>
        </div>
    );
}
