'use client';

import {
    ZoruCardContent,
    ZoruCardDescription,
    ZoruCardHeader,
    ZoruCardTitle,
    Badge,
    Separator,
} from '@/components/zoruui';
import { UserProfileFormProps } from './types';
import { 
    CheckCircle2, 
    Clock, 
    User as UserIcon, 
    Briefcase, 
    Globe, 
    Layers 
} from 'lucide-react';

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
            day: 'numeric'
        });
    };

    return (
        <>
            <ZoruCardHeader>
                <ZoruCardTitle className="flex items-center gap-2">
                    <Layers className="h-5 w-5" />
                    Onboarding Details
                </ZoruCardTitle>
                <ZoruCardDescription>
                    Setup information collected during your onboarding.
                </ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-5">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zoru-ink-muted">Status</span>
                    <Badge variant={isComplete ? 'default' : 'secondary'}>
                        {isComplete ? (
                            <><CheckCircle2 className="mr-1 h-3 w-3" /> Complete</>
                        ) : (
                            <><Clock className="mr-1 h-3 w-3" /> In progress ({ob.status})</>
                        )}
                    </Badge>
                </div>

                <Separator />

                {ob.profile && (
                    <div className="space-y-2">
                        <p className="text-sm font-semibold flex items-center gap-1.5">
                            <UserIcon className="h-3.5 w-3.5 text-zoru-ink-muted" /> Profile
                        </p>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                            {ob.profile.companyName && (
                                <><span className="text-zoru-ink-muted">Company</span><span>{ob.profile.companyName}</span></>
                            )}
                            {ob.profile.role && (
                                <><span className="text-zoru-ink-muted">Role</span><span>{ob.profile.role}</span></>
                            )}
                            {ob.profile.country && (
                                <><span className="text-zoru-ink-muted">Country</span><span>{ob.profile.country}</span></>
                            )}
                            {ob.profile.phone && (
                                <><span className="text-zoru-ink-muted">Phone</span><span>{ob.profile.phone}</span></>
                            )}
                            {ob.profile.website && (
                                <><span className="text-zoru-ink-muted">Website</span><span>{ob.profile.website}</span></>
                            )}
                        </div>
                    </div>
                )}

                {ob.business && (
                    <div className="space-y-2">
                        <p className="text-sm font-semibold flex items-center gap-1.5">
                            <Briefcase className="h-3.5 w-3.5 text-zoru-ink-muted" /> Business
                        </p>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                            {ob.business.industry && (
                                <><span className="text-zoru-ink-muted">Industry</span><span>{ob.business.industry}</span></>
                            )}
                            {ob.business.teamSize && (
                                <><span className="text-zoru-ink-muted">Team size</span><span>{ob.business.teamSize}</span></>
                            )}
                            {ob.business.monthlyVolume && (
                                <><span className="text-zoru-ink-muted">Monthly volume</span><span>{ob.business.monthlyVolume}</span></>
                            )}
                            {ob.business.useCases && ob.business.useCases.length > 0 && (
                                <><span className="text-zoru-ink-muted">Use cases</span><span>{ob.business.useCases.join(', ')}</span></>
                            )}
                        </div>
                    </div>
                )}

                {(modules.length > 0 || ob.requirements) && (
                    <div className="space-y-2">
                        <p className="text-sm font-semibold flex items-center gap-1.5">
                            <Globe className="h-3.5 w-3.5 text-zoru-ink-muted" /> Requirements
                        </p>
                        {modules.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {modules.map((m) => (
                                    <Badge key={m} variant="outline" className="text-xs">{m}</Badge>
                                ))}
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                            {ob.requirements?.primaryGoal && (
                                <><span className="text-zoru-ink-muted">Primary goal</span><span>{ob.requirements.primaryGoal}</span></>
                            )}
                            {ob.requirements?.currentTools && (
                                <><span className="text-zoru-ink-muted">Current tools</span><span>{ob.requirements.currentTools}</span></>
                            )}
                            {ob.requirements?.timeline && (
                                <><span className="text-zoru-ink-muted">Timeline</span><span>{ob.requirements.timeline}</span></>
                            )}
                        </div>
                    </div>
                )}

                {(ob.startedAt || ob.completedAt) && (
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm pt-2 border-t">
                        {ob.startedAt && (
                            <><span className="text-zoru-ink-muted">Started</span><span>{formatSafeDate(ob.startedAt)}</span></>
                        )}
                        {ob.completedAt && (
                            <><span className="text-zoru-ink-muted">Completed</span><span>{formatSafeDate(ob.completedAt)}</span></>
                        )}
                    </div>
                )}
            </ZoruCardContent>
        </>
    );
}
