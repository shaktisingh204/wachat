import React from 'react';
import { PageHeader, ZoruPageHeading, ZoruPageTitle, ZoruPageDescription, Card, ZoruCardHeader, ZoruCardTitle, ZoruCardContent, Badge, Button, Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/sabcrm/20ui/compat';
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
                    <ZoruPageHeading>
                        <ZoruPageTitle>MDM Profiles</ZoruPageTitle>
                        <ZoruPageDescription>Manage mobile device management profiles and policies across your fleet.</ZoruPageDescription>
                    </ZoruPageHeading>
                    <Button>
                        <Plus className="mr-2 size-4" />
                        Create Profile
                    </Button>
                </div>
            </PageHeader>

            <Card>
                <ZoruCardHeader>
                    <ZoruCardTitle>Active Profiles</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Profile Name</TableHead>
                                <TableHead>Platform</TableHead>
                                <TableHead>Devices Assigned</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {profiles.map(profile => (
                                <TableRow key={profile.id}>
                                    <TableCell className="font-medium flex items-center gap-2">
                                        <ShieldCheck className="size-4 text-[var(--st-text-secondary)]" />
                                        {profile.name}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
                                            {profile.platform === 'iOS' || profile.platform === 'Android' ? <Smartphone className="size-3" /> : <Laptop className="size-3" />}
                                            {profile.platform}
                                        </div>
                                    </TableCell>
                                    <TableCell>{profile.assigned}</TableCell>
                                    <TableCell>
                                        <Badge variant={profile.status === 'Active' ? 'default' : 'secondary'}>
                                            {profile.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="outline" size="sm">Edit</Button>
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
