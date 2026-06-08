'use client';

import { CardBody, CardDescription, CardHeader, CardTitle, Badge, Separator } from '@/components/sabcrm/20ui';
import { UserProfileFormProps } from './types';
import {
    CheckCircle2,
    Clock,
    User as UserIcon,
    Briefcase,
    Globe,
    Layers,
} from 'lucide-react';

function DefRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-baseline justify-between gap-3 py-1">
            <dt className="shrink-0 text-xs text-[var(--st-text-secondary)]">{label}</dt>
            <dd className="min-w-0 truncate text-right text-sm font-medium text-[var(--st-text)]">
                {value}
            </dd>
        </div>
    );
}

function Section({
    icon: Icon,
    title,
    children,
}: {
    icon: React.ElementType;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-[var(--st-text)]">
                <Icon size={14} aria-hidden="true" className="text-[var(--st-text-secondary)]" />
                {title}
            </p>
            <dl className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-1.5">
                {children}
            </dl>
        </div>
    );
}

export function OnboardingDetailsCard({ user }: UserProfileFormProps) {
    const ob = user.onboarding;
    if (!ob) return null;

    const isComplete = ob.status === 'complete';
    const modules = ob.requirements?.modules ?? user.enabledModules ?? [];

    const formatSafeDate = (dateString?: string | Date | null) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    return (
        <>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Layers size={16} aria-hidden="true" />
                    Onboarding details
                </CardTitle>
                <CardDescription>
                    Setup information collected during your onboarding.
                </CardDescription>
            </CardHeader>
            <CardBody className="space-y-4">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--st-text-secondary)]">Status</span>
                    {isComplete ? (
                        <Badge tone="success" kind="soft">
                            <CheckCircle2 size={12} aria-hidden="true" />
                            Complete
                        </Badge>
                    ) : (
                        <Badge tone="warning" kind="soft">
                            <Clock size={12} aria-hidden="true" />
                            In progress ({ob.status})
                        </Badge>
                    )}
                </div>

                <Separator />

                <div className="grid gap-4 sm:grid-cols-2">
                    {ob.profile && (
                        <Section icon={UserIcon} title="Profile">
                            {ob.profile.companyName && <DefRow label="Company" value={ob.profile.companyName} />}
                            {ob.profile.role && <DefRow label="Role" value={ob.profile.role} />}
                            {ob.profile.country && <DefRow label="Country" value={ob.profile.country} />}
                            {ob.profile.phone && <DefRow label="Phone" value={ob.profile.phone} />}
                            {ob.profile.website && <DefRow label="Website" value={ob.profile.website} />}
                        </Section>
                    )}

                    {ob.business && (
                        <Section icon={Briefcase} title="Business">
                            {ob.business.industry && <DefRow label="Industry" value={ob.business.industry} />}
                            {ob.business.teamSize && <DefRow label="Team size" value={ob.business.teamSize} />}
                            {ob.business.monthlyVolume && (
                                <DefRow label="Monthly volume" value={ob.business.monthlyVolume} />
                            )}
                            {ob.business.useCases && ob.business.useCases.length > 0 && (
                                <DefRow label="Use cases" value={ob.business.useCases.join(', ')} />
                            )}
                        </Section>
                    )}
                </div>

                {(modules.length > 0 || ob.requirements) && (
                    <div className="space-y-2">
                        <p className="flex items-center gap-1.5 text-sm font-semibold text-[var(--st-text)]">
                            <Globe size={14} aria-hidden="true" className="text-[var(--st-text-secondary)]" />
                            Requirements
                        </p>
                        {modules.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {modules.map((m) => (
                                    <Badge key={m} tone="accent" kind="outline">
                                        {m}
                                    </Badge>
                                ))}
                            </div>
                        )}
                        {(ob.requirements?.primaryGoal ||
                            ob.requirements?.currentTools ||
                            ob.requirements?.timeline) && (
                            <dl className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-1.5">
                                {ob.requirements?.primaryGoal && (
                                    <DefRow label="Primary goal" value={ob.requirements.primaryGoal} />
                                )}
                                {ob.requirements?.currentTools && (
                                    <DefRow label="Current tools" value={ob.requirements.currentTools} />
                                )}
                                {ob.requirements?.timeline && (
                                    <DefRow label="Timeline" value={ob.requirements.timeline} />
                                )}
                            </dl>
                        )}
                    </div>
                )}

                {(ob.startedAt || ob.completedAt) && (
                    <>
                        <Separator />
                        <dl className="grid grid-cols-2 gap-x-6">
                            {ob.startedAt && <DefRow label="Started" value={formatSafeDate(ob.startedAt)} />}
                            {ob.completedAt && (
                                <DefRow label="Completed" value={formatSafeDate(ob.completedAt)} />
                            )}
                        </dl>
                    </>
                )}
            </CardBody>
        </>
    );
}
