import React from 'react';
import { PageHeader, ZoruPageHeading, ZoruPageTitle, ZoruPageDescription, Card, ZoruCardHeader, ZoruCardTitle, ZoruCardContent, Badge, Button, Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/zoruui';
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
                    <ZoruPageHeading>
                        <ZoruPageTitle>System Alerts</ZoruPageTitle>
                        <ZoruPageDescription>Monitor and acknowledge automated system alerts and notifications.</ZoruPageDescription>
                    </ZoruPageHeading>
                    <Button variant="outline">
                        Acknowledge All
                    </Button>
                </div>
            </PageHeader>

            <Card>
                <ZoruCardHeader>
                    <ZoruCardTitle>Active Alerts</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Alert ID</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Severity</TableHead>
                                <TableHead>Source</TableHead>
                                <TableHead>Time</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {alerts.map(alert => (
                                <TableRow key={alert.id}>
                                    <TableCell className="font-medium">{alert.id}</TableCell>
                                    <TableCell>{alert.title}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {getSeverityIcon(alert.severity)}
                                            {alert.severity}
                                        </div>
                                    </TableCell>
                                    <TableCell>{alert.source}</TableCell>
                                    <TableCell className="text-sm text-zoru-muted-foreground">{alert.time}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="secondary" size="sm">Resolve</Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ZoruCardContent>
            </Card>
        </div>
    );
}
