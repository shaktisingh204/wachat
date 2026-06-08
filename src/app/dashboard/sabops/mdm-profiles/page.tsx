import { Laptop, Plus, ShieldCheck, Smartphone, Users } from 'lucide-react';

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

type ProfileStatus = 'Active' | 'Deprecated';

const STATUS_TONE: Record<ProfileStatus, BadgeTone> = {
    Active: 'success',
    Deprecated: 'neutral',
};

const MOBILE_PLATFORMS = new Set(['iOS', 'Android']);

export default function MdmProfilesPage() {
    const profiles: Array<{
        id: number;
        name: string;
        platform: string;
        assigned: number;
        status: ProfileStatus;
    }> = [
        { id: 1, name: 'Default iOS policy', platform: 'iOS', assigned: 142, status: 'Active' },
        { id: 2, name: 'macOS developer config', platform: 'macOS', assigned: 45, status: 'Active' },
        { id: 3, name: 'Windows Defender enforce', platform: 'Windows', assigned: 210, status: 'Active' },
        { id: 4, name: 'Legacy Android', platform: 'Android', assigned: 12, status: 'Deprecated' },
    ];

    const activeCount = profiles.filter((p) => p.status === 'Active').length;
    const totalAssigned = profiles.reduce((sum, p) => sum + p.assigned, 0);

    return (
        <div className="flex flex-col gap-6">
            <PageHeader>
                <PageHeading>
                    <PageEyebrow>SabOps</PageEyebrow>
                    <PageTitle>MDM profiles</PageTitle>
                    <PageDescription>
                        Manage mobile device management profiles and policies across your fleet.
                    </PageDescription>
                </PageHeading>
                <PageActions>
                    <Button variant="primary" iconLeft={Plus}>
                        Create profile
                    </Button>
                </PageActions>
            </PageHeader>

            <section
                aria-label="Profile summary"
                className="grid grid-cols-1 gap-4 sm:grid-cols-3"
            >
                <StatCard
                    label="Profiles"
                    value={profiles.length}
                    icon={ShieldCheck}
                    accent="#3b7af5"
                />
                <StatCard label="Active" value={activeCount} icon={ShieldCheck} accent="#1f9d55" />
                <StatCard
                    label="Devices assigned"
                    value={totalAssigned}
                    icon={Users}
                    accent="#7c3aed"
                />
            </section>

            <Card variant="outlined" padding="none">
                <Table>
                    <THead>
                        <Tr>
                            <Th>Profile name</Th>
                            <Th>Platform</Th>
                            <Th align="right">Devices assigned</Th>
                            <Th>Status</Th>
                            <Th align="right">Action</Th>
                        </Tr>
                    </THead>
                    <TBody>
                        {profiles.map((profile) => (
                            <Tr key={profile.id}>
                                <Td>
                                    <span className="inline-flex items-center gap-2 font-medium text-[var(--st-text)]">
                                        <ShieldCheck
                                            className="size-4 text-[var(--st-text-secondary)]"
                                            aria-hidden="true"
                                        />
                                        {profile.name}
                                    </span>
                                </Td>
                                <Td>
                                    <span className="inline-flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
                                        {MOBILE_PLATFORMS.has(profile.platform) ? (
                                            <Smartphone className="size-3.5" aria-hidden="true" />
                                        ) : (
                                            <Laptop className="size-3.5" aria-hidden="true" />
                                        )}
                                        {profile.platform}
                                    </span>
                                </Td>
                                <Td align="right" className="tabular-nums text-[var(--st-text)]">
                                    {profile.assigned}
                                </Td>
                                <Td>
                                    <Badge tone={STATUS_TONE[profile.status]} dot>
                                        {profile.status}
                                    </Badge>
                                </Td>
                                <Td align="right">
                                    <Button variant="outline" size="sm">
                                        Edit
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
