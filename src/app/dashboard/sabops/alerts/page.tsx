import React from 'react';
import { PageHeader, PageHeading, PageTitle, PageDescription, Card, CardHeader, CardTitle, CardBody, Badge, Button, Table, THead, Tr, Th, TBody, Td } from '@/components/sabcrm/20ui/compat';
import { Server, AlertTriangle, AlertCircle, Info, CheckCircle2 } from 'lucide-react';

export default function AlertsPage() {
    const alerts = [
        { id: 'ALT-100', title: 'High CPU Usage on DB-01', severity: 'Critical', source: 'Prometheus', time: '10 mins ago' },
        { id: 'ALT-101', title: 'Disk Space Warning - AP-04', severity: 'High', source: 'Datadog', time: '1 hour ago' },
        { id: 'ALT-102', title: 'Failed Login Attempts Spikes', severity: 'Medium', source: 'Auth0', time: '3 hours ago' },
        { id: 'ALT-103', title: 'Routine Backup Completed', severity: 'Low', source: 'AWS Backup', time: '12 hours ago' },
    ];

    const getSeverityIcon = (severity: string) => {
        switch (severity) {
            case 'Critical': return <AlertCircle className="size-4 text-red-500" />;
            case 'High': return <AlertTriangle className="size-4 text-orange-500" />;
            case 'Medium': return <Info className="size-4 text-yellow-500" />;
            default: return <CheckCircle2 className="size-4 text-green-500" />;
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <PageHeader>
                <div className="flex w-full items-center justify-between">
                    <PageHeading>
                        <PageTitle>System Alerts</PageTitle>
                        <PageDescription>Monitor and acknowledge automated system alerts and notifications.</PageDescription>
                    </PageHeading>
                    <Button variant="outline">
                        Acknowledge All
                    </Button>
                </div>
            </PageHeader>

            <Card>
                <CardHeader>
                    <CardTitle>Active Alerts</CardTitle>
                </CardHeader>
                <CardBody>
                    <Table>
                        <THead>
                            <Tr>
                                <Th>Alert ID</Th>
                                <Th>Description</Th>
                                <Th>Severity</Th>
                                <Th>Source</Th>
                                <Th>Time</Th>
                                <Th className="text-right">Action</Th>
                            </Tr>
                        </THead>
                        <TBody>
                            {alerts.map(alert => (
                                <Tr key={alert.id}>
                                    <Td className="font-medium">{alert.id}</Td>
                                    <Td>{alert.title}</Td>
                                    <Td>
                                        <div className="flex items-center gap-2">
                                            {getSeverityIcon(alert.severity)}
                                            {alert.severity}
                                        </div>
                                    </Td>
                                    <Td>{alert.source}</Td>
                                    <Td className="text-sm text-[var(--st-text-secondary)]">{alert.time}</Td>
                                    <Td className="text-right">
                                        <Button variant="secondary" size="sm">Resolve</Button>
                                    </Td>
                                </Tr>
                            ))}
                        </TBody>
                    </Table>
                </CardBody>
            </Card>
        </div>
    );
}
