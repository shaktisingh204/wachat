import {
    AlertCircle,
    AlertTriangle,
    CheckCheck,
    CheckCircle2,
    Info,
    ShieldAlert,
} from 'lucide-react';

import {
    Badge,
    Button,
    Card,
    PageActions,
    PageDescription,
    PageEyebrow,
    PageHeader,
    PageHeading,
    PageTitle,
    StatCard,
    TBody,
    THead,
    Table,
    Td,
    Th,
    Tr,
    type BadgeTone,
} from '@/components/sabcrm/20ui';

type Severity = 'Critical' | 'High' | 'Medium' | 'Low';

const SEVERITY_TONE: Record<Severity, BadgeTone> = {
    Critical: 'danger',
    High: 'warning',
    Medium: 'info',
    Low: 'neutral',
};

function severityIcon(severity: Severity) {
    switch (severity) {
        case 'Critical':
            return <AlertCircle className="size-4 text-[var(--st-danger)]" aria-hidden="true" />;
        case 'High':
            return <AlertTriangle className="size-4 text-[var(--st-warn)]" aria-hidden="true" />;
        case 'Medium':
            return <Info className="size-4 text-[var(--st-accent)]" aria-hidden="true" />;
        default:
            return <CheckCircle2 className="size-4 text-[var(--st-success)]" aria-hidden="true" />;
    }
}

export default function AlertsPage() {
    const alerts: Array<{
        id: string;
        title: string;
        severity: Severity;
        source: string;
        time: string;
    }> = [
        { id: 'ALT-100', title: 'High CPU usage on DB-01', severity: 'Critical', source: 'Prometheus', time: '10 mins ago' },
        { id: 'ALT-101', title: 'Disk space warning on AP-04', severity: 'High', source: 'Datadog', time: '1 hour ago' },
        { id: 'ALT-102', title: 'Failed login attempt spike', severity: 'Medium', source: 'Auth0', time: '3 hours ago' },
        { id: 'ALT-103', title: 'Routine backup completed', severity: 'Low', source: 'AWS Backup', time: '12 hours ago' },
    ];

    const critical = alerts.filter((a) => a.severity === 'Critical').length;
    const high = alerts.filter((a) => a.severity === 'High').length;

    return (
        <div className="flex flex-col gap-6">
            <PageHeader>
                <PageHeading>
                    <PageEyebrow>SabOps</PageEyebrow>
                    <PageTitle>System alerts</PageTitle>
                    <PageDescription>
                        Monitor and acknowledge automated system alerts and notifications.
                    </PageDescription>
                </PageHeading>
                <PageActions>
                    <Button variant="outline" iconLeft={CheckCheck}>
                        Acknowledge all
                    </Button>
                </PageActions>
            </PageHeader>

            <section
                aria-label="Alert summary"
                className="grid grid-cols-1 gap-4 sm:grid-cols-3"
            >
                <StatCard
                    label="Open alerts"
                    value={alerts.length}
                    icon={ShieldAlert}
                    accent="#3b7af5"
                />
                <StatCard
                    label="Critical"
                    value={critical}
                    icon={AlertCircle}
                    accent="#e0484e"
                />
                <StatCard label="High" value={high} icon={AlertTriangle} accent="#d97706" />
            </section>

            <Card variant="outlined" padding="none">
                <Table>
                    <THead>
                        <Tr>
                            <Th>Alert ID</Th>
                            <Th>Description</Th>
                            <Th>Severity</Th>
                            <Th>Source</Th>
                            <Th>Time</Th>
                            <Th align="right">Action</Th>
                        </Tr>
                    </THead>
                    <TBody>
                        {alerts.map((alert) => (
                            <Tr key={alert.id}>
                                <Td className="font-mono text-xs font-medium text-[var(--st-text)]">
                                    {alert.id}
                                </Td>
                                <Td className="text-[var(--st-text)]">{alert.title}</Td>
                                <Td>
                                    <Badge
                                        tone={SEVERITY_TONE[alert.severity]}
                                        kind="soft"
                                        className="inline-flex items-center gap-1.5"
                                    >
                                        {severityIcon(alert.severity)}
                                        {alert.severity}
                                    </Badge>
                                </Td>
                                <Td className="text-[var(--st-text-secondary)]">{alert.source}</Td>
                                <Td className="text-[var(--st-text-secondary)]">{alert.time}</Td>
                                <Td align="right">
                                    <Button variant="secondary" size="sm">
                                        Resolve
                                    </Button>
                                </Td>
                            </Tr>
                        ))}
                    </TBody>
                </Table>
            </Card>
        </div>
    );
}
