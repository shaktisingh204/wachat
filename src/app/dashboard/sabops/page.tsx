import { Server, ShieldAlert, Package, Send } from "lucide-react";

import {
    Card,
    ZoruCardContent,
    ZoruCardHeader,
    ZoruCardTitle,
    PageHeader,
    ZoruPageHeading,
    ZoruPageTitle,
    ZoruPageDescription,
    StatCard,
} from "@/components/zoruui";
import {
    listSabopsEndpoints,
    listSabopsAlerts,
    listSabopsPatches,
    listSabopsMdmCommands,
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
                <ZoruPageHeading>
                    <ZoruPageTitle>SabOps</ZoruPageTitle>
                    <ZoruPageDescription>
                        Endpoint management, MDM, Active Directory, and patching for your fleet.
                    </ZoruPageDescription>
                </ZoruPageHeading>
            </PageHeader>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    label="Online endpoints"
                    value={byStatus.online ?? 0}
                    helper={`${endpoints.items.length} total`}
                    icon={<Server className="size-4" />}
                />
                <StatCard
                    label="Open alerts"
                    value={alerts.items.length}
                    helper={`${bySeverity.critical ?? 0} critical · ${bySeverity.high ?? 0} high`}
                    icon={<ShieldAlert className="size-4" />}
                />
                <StatCard
                    label="Pending patches"
                    value={patches.items.length}
                    helper="Severity-prioritized"
                    icon={<Package className="size-4" />}
                />
                <StatCard
                    label="Recent MDM commands"
                    value={commands.items.length}
                    helper="Last 10 issued"
                    icon={<Send className="size-4" />}
                />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Endpoints by status</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <ul className="grid grid-cols-2 gap-3 text-sm">
                            {(["online", "offline", "stale", "disabled"] as const).map((s) => (
                                <li
                                    key={s}
                                    className="flex items-center justify-between rounded border border-[var(--zoru-border)] px-3 py-2"
                                >
                                    <span className="capitalize text-[var(--zoru-muted-foreground)]">
                                        {s}
                                    </span>
                                    <span className="font-semibold">{byStatus[s] ?? 0}</span>
                                </li>
                            ))}
                        </ul>
                    </ZoruCardContent>
                </Card>

                <Card>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Alerts by severity</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <ul className="grid grid-cols-2 gap-3 text-sm">
                            {(["critical", "high", "medium", "low"] as const).map((s) => (
                                <li
                                    key={s}
                                    className="flex items-center justify-between rounded border border-[var(--zoru-border)] px-3 py-2"
                                >
                                    <span className="capitalize text-[var(--zoru-muted-foreground)]">
                                        {s}
                                    </span>
                                    <span className="font-semibold">{bySeverity[s] ?? 0}</span>
                                </li>
                            ))}
                        </ul>
                    </ZoruCardContent>
                </Card>
            </div>
        </div>
    );
}
