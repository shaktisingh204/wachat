import React from 'react';
import { PageHeader, PageHeading, PageTitle, PageDescription, Card, CardHeader, CardTitle, CardBody, Badge, Button, Table, THead, Tr, Th, TBody, Td } from '@/components/sabcrm/20ui/compat';
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
                    <PageHeading>
                        <PageTitle>Hardware Inventory</PageTitle>
                        <PageDescription>Track and manage all hardware assets across your organization.</PageDescription>
                    </PageHeading>
                    <Button variant="outline">
                        <Download className="mr-2 size-4" />
                        Export CSV
                    </Button>
                </div>
            </PageHeader>

            <Card>
                <CardHeader>
                    <CardTitle>Device Roster</CardTitle>
                </CardHeader>
                <CardBody>
                    <Table>
                        <THead>
                            <Tr>
                                <Th>Asset Tag</Th>
                                <Th>Assigned To</Th>
                                <Th>Hardware Model</Th>
                                <Th>OS Version</Th>
                                <Th>Status</Th>
                            </Tr>
                        </THead>
                        <TBody>
                            {devices.map(device => (
                                <Tr key={device.id}>
                                    <Td className="font-medium flex items-center gap-2">
                                        <HardDrive className="size-4 text-[var(--st-text-secondary)]" />
                                        {device.id}
                                    </Td>
                                    <Td>{device.user}</Td>
                                    <Td>{device.model}</Td>
                                    <Td>{device.os}</Td>
                                    <Td>
                                        <Badge variant={device.status === 'Online' ? 'default' : device.status === 'Offline' ? 'secondary' : 'destructive'}>
                                            {device.status}
                                        </Badge>
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
