import { Download, HardDrive, Laptop, MonitorSmartphone, Wifi } from 'lucide-react';

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

type DeviceStatus = 'Online' | 'Offline' | 'Stale';

const STATUS_TONE: Record<DeviceStatus, BadgeTone> = {
    Online: 'success',
    Offline: 'neutral',
    Stale: 'warning',
};

export default function InventoryPage() {
    const devices: Array<{
        id: string;
        user: string;
        model: string;
        os: string;
        status: DeviceStatus;
    }> = [
        { id: 'DEV-8829', user: 'Aanya Sharma', model: 'MacBook Pro 14"', os: 'macOS 14.1', status: 'Online' },
        { id: 'DEV-1023', user: 'Rohan Mehta', model: 'ThinkPad T14', os: 'Windows 11', status: 'Offline' },
        { id: 'DEV-9921', user: 'Mei Lin', model: 'iPhone 15 Pro', os: 'iOS 17.2', status: 'Online' },
        { id: 'DEV-4432', user: 'Diego Alvarez', model: 'Dell XPS 13', os: 'Ubuntu 22.04', status: 'Stale' },
    ];

    const online = devices.filter((d) => d.status === 'Online').length;
    const stale = devices.filter((d) => d.status === 'Stale').length;

    return (
        <div className="flex flex-col gap-6">
            <PageHeader>
                <PageHeading>
                    <PageEyebrow>SabOps</PageEyebrow>
                    <PageTitle>Hardware inventory</PageTitle>
                    <PageDescription>
                        Track and manage every hardware asset across your organization.
                    </PageDescription>
                </PageHeading>
                <PageActions>
                    <Button variant="outline" iconLeft={Download}>
                        Export CSV
                    </Button>
                </PageActions>
            </PageHeader>

            <section
                aria-label="Inventory summary"
                className="grid grid-cols-1 gap-4 sm:grid-cols-3"
            >
                <StatCard
                    label="Total devices"
                    value={devices.length}
                    icon={MonitorSmartphone}
                    accent="#3b7af5"
                />
                <StatCard label="Online" value={online} icon={Wifi} accent="#1f9d55" />
                <StatCard label="Stale" value={stale} icon={Laptop} accent="#d97706" />
            </section>

            <Card variant="outlined" padding="none">
                <Table>
                    <THead>
                        <Tr>
                            <Th>Asset tag</Th>
                            <Th>Assigned to</Th>
                            <Th>Hardware model</Th>
                            <Th>OS version</Th>
                            <Th>Status</Th>
                        </Tr>
                    </THead>
                    <TBody>
                        {devices.map((device) => (
                            <Tr key={device.id}>
                                <Td>
                                    <span className="inline-flex items-center gap-2 font-mono text-xs font-medium text-[var(--st-text)]">
                                        <HardDrive
                                            className="size-4 text-[var(--st-text-secondary)]"
                                            aria-hidden="true"
                                        />
                                        {device.id}
                                    </span>
                                </Td>
                                <Td className="text-[var(--st-text)]">{device.user}</Td>
                                <Td className="text-[var(--st-text-secondary)]">{device.model}</Td>
                                <Td className="text-[var(--st-text-secondary)]">{device.os}</Td>
                                <Td>
                                    <Badge tone={STATUS_TONE[device.status]} dot>
                                        {device.status}
                                    </Badge>
                                </Td>
                            </Tr>
                        ))}
                    </TBody>
                </Table>
            </Card>
        </div>
    );
}
