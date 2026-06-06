import React from 'react';
import { PageHeader, PageHeading, PageTitle, PageDescription, Card, CardHeader, CardTitle, CardBody, Badge, Button, Table, THead, Tr, Th, TBody, Td } from '@/components/sabcrm/20ui';
import { ShieldCheck, Plus, Smartphone, Laptop } from 'lucide-react';

export default function MdmProfilesPage() {
    const profiles = [
        { id: 1, name: 'Default iOS Policy', platform: 'iOS', assigned: 142, status: 'Active' },
        { id: 2, name: 'macOS Developer Config', platform: 'macOS', assigned: 45, status: 'Active' },
        { id: 3, name: 'Windows Defender Enforce', platform: 'Windows', assigned: 210, status: 'Active' },
        { id: 4, name: 'Legacy Android', platform: 'Android', assigned: 12, status: 'Deprecated' }
    ];

    return (
        <div className="flex flex-col gap-6">
            <PageHeader>
                <div className="flex w-full items-center justify-between">
                    <PageHeading>
                        <PageTitle>MDM Profiles</PageTitle>
                        <PageDescription>Manage mobile device management profiles and policies across your fleet.</PageDescription>
                    </PageHeading>
                    <Button>
                        <Plus className="mr-2 size-4" />
                        Create Profile
                    </Button>
                </div>
            </PageHeader>

            <Card>
                <CardHeader>
                    <CardTitle>Active Profiles</CardTitle>
                </CardHeader>
                <CardBody>
                    <Table>
                        <THead>
                            <Tr>
                                <Th>Profile Name</Th>
                                <Th>Platform</Th>
                                <Th>Devices Assigned</Th>
                                <Th>Status</Th>
                                <Th className="text-right">Actions</Th>
                            </Tr>
                        </THead>
                        <TBody>
                            {profiles.map(profile => (
                                <Tr key={profile.id}>
                                    <Td className="font-medium flex items-center gap-2">
                                        <ShieldCheck className="size-4 text-[var(--st-text-secondary)]" />
                                        {profile.name}
                                    </Td>
                                    <Td>
                                        <div className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
                                            {profile.platform === 'iOS' || profile.platform === 'Android' ? <Smartphone className="size-3" /> : <Laptop className="size-3" />}
                                            {profile.platform}
                                        </div>
                                    </Td>
                                    <Td>{profile.assigned}</Td>
                                    <Td>
                                        <Badge variant={profile.status === 'Active' ? 'default' : 'secondary'}>
                                            {profile.status}
                                        </Badge>
                                    </Td>
                                    <Td className="text-right">
                                        <Button variant="outline" size="sm">Edit</Button>
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
