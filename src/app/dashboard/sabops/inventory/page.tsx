import React from 'react';
import { PageHeader, ZoruPageHeading, ZoruPageTitle, ZoruPageDescription, Card, ZoruCardHeader, ZoruCardTitle, ZoruCardContent, Badge, Button, Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/sabcrm/20ui/compat';
import { Package, Download, HardDrive } from 'lucide-react';

export default function InventoryPage() {
    const devices = [
        { id: 'DEV-8829', user: 'Alice Smith', model: 'MacBook Pro 14"', os: 'macOS 14.1', status: 'Online' },
        { id: 'DEV-1023', user: 'Bob Johnson', model: 'ThinkPad T14', os: 'Windows 11', status: 'Offline' },
        { id: 'DEV-9921', user: 'Charlie Lee', model: 'iPhone 15 Pro', os: 'iOS 17.2', status: 'Online' },
        { id: 'DEV-4432', user: 'Diana Prince', model: 'Dell XPS 13', os: 'Ubuntu 22.04', status: 'Stale' },
    ];

    return (
        <div className="flex flex-col gap-6">
            <PageHeader>
                <div className="flex w-full items-center justify-between">
                    <ZoruPageHeading>
                        <ZoruPageTitle>Hardware Inventory</ZoruPageTitle>
                        <ZoruPageDescription>Track and manage all hardware assets across your organization.</ZoruPageDescription>
                    </ZoruPageHeading>
                    <Button variant="outline">
                        <Download className="mr-2 size-4" />
                        Export CSV
                    </Button>
                </div>
            </PageHeader>

            <Card>
                <ZoruCardHeader>
                    <ZoruCardTitle>Device Roster</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Asset Tag</TableHead>
                                <TableHead>Assigned To</TableHead>
                                <TableHead>Hardware Model</TableHead>
                                <TableHead>OS Version</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {devices.map(device => (
                                <TableRow key={device.id}>
                                    <TableCell className="font-medium flex items-center gap-2">
                                        <HardDrive className="size-4 text-[var(--st-text-secondary)]" />
                                        {device.id}
                                    </TableCell>
                                    <TableCell>{device.user}</TableCell>
                                    <TableCell>{device.model}</TableCell>
                                    <TableCell>{device.os}</TableCell>
                                    <TableCell>
                                        <Badge variant={device.status === 'Online' ? 'default' : device.status === 'Offline' ? 'secondary' : 'destructive'}>
                                            {device.status}
                                        </Badge>
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
