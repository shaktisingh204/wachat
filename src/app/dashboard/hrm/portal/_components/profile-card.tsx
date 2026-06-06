'use client';

import { useState, useEffect } from 'react';
import {
    Card,
    Badge,
} from '@/components/sabcrm/20ui/compat';
import { Building2, Briefcase, CalendarDays, Hash } from 'lucide-react';
import { fmtDate } from '@/lib/utils';
import type { PortalEmployeeProfile } from '@/app/actions/hrm-portal.actions.types';

interface ProfileCardProps {
    profile: PortalEmployeeProfile;
}

function statusVariant(status: PortalEmployeeProfile['status']) {
    if (status === 'Active') return 'success' as const;
    if (status === 'Inactive') return 'warning' as const;
    return 'danger' as const;
}

function initials(first: string, last: string): string {
    return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}

function ClientDate({ iso }: { iso: string | null }) {
    const [dateStr, setDateStr] = useState('—');

    useEffect(() => {
        if (!iso) {
            setDateStr('—');
            return;
        }
        setDateStr(fmtDate(iso));
    }, [iso]);

    return <>{dateStr}</>;
}

export function ProfileCard({ profile }: ProfileCardProps) {
    return (
        <Card className="p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                {/* Avatar */}
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[var(--st-text)]/10 text-xl font-semibold text-[var(--st-text)]">
                    {initials(profile.firstName, profile.lastName)}
                </div>

                {/* Core info */}
                <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-[18px] font-semibold text-[var(--st-text)]">
                            {profile.firstName} {profile.lastName}
                        </h2>
                        <Badge variant={statusVariant(profile.status)}>
                            {profile.status}
                        </Badge>
                    </div>

                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-[var(--st-text-secondary)]">
                        {profile.designationName && (
                            <span className="flex items-center gap-1.5">
                                <Briefcase className="h-3.5 w-3.5 shrink-0" />
                                {profile.designationName}
                            </span>
                        )}
                        {profile.departmentName && (
                            <span className="flex items-center gap-1.5">
                                <Building2 className="h-3.5 w-3.5 shrink-0" />
                                {profile.departmentName}
                            </span>
                        )}
                        <span className="flex items-center gap-1.5">
                            <Hash className="h-3.5 w-3.5 shrink-0" />
                            <span className="font-mono text-[12.5px]">{profile.employeeId}</span>
                        </span>
                        {profile.dateOfJoining && (
                            <span className="flex items-center gap-1.5">
                                <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                                Joined <ClientDate iso={profile.dateOfJoining} />
                            </span>
                        )}
                    </div>

                    {profile.reportingManagerName && (
                        <p className="text-[12.5px] text-[var(--st-text-secondary)]">
                            Reports to:{' '}
                            <span className="font-medium text-[var(--st-text)]">
                                {profile.reportingManagerName}
                            </span>
                        </p>
                    )}
                </div>
            </div>
        </Card>
    );
}
