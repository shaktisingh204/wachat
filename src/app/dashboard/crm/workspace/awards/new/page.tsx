'use client';

import { AwardsForm } from '../_components/awards-form';
import { Card, ZoruCardHeader, ZoruCardTitle, ZoruCardDescription, ZoruCardContent, StatCard } from '@/components/sabcrm/20ui/compat';
import { Trophy, Users, Star, Lightbulb } from 'lucide-react';

export default function NewAwardPage() {
    return (
        <div className="flex w-full flex-col gap-6 p-4 md:p-6">
            {/* Specialized Metrics Dashboard */}
            <div className="grid gap-4 md:grid-cols-3">
                <StatCard
                    label="Active Programs"
                    value="12"
                    icon={<Trophy />}
                    delta={8.5}
                    period="vs last month"
                />
                <StatCard
                    label="Recent Nominations"
                    value="48"
                    icon={<Users />}
                    delta={14}
                    period="vs last month"
                />
                <StatCard
                    label="Engagement Rate"
                    value="92%"
                    icon={<Star />}
                    delta={2.1}
                    period="vs last month"
                />
            </div>

            <div className="grid gap-6 md:grid-cols-[1fr_300px]">
                <div className="flex flex-col gap-6">
                    <AwardsForm mode="new" />
                </div>
                
                {/* Quick Action Shortcuts / Tips */}
                <div className="flex flex-col gap-4">
                    <Card>
                        <ZoruCardHeader>
                            <ZoruCardTitle className="flex items-center gap-2">
                                <Lightbulb className="h-4 w-4 text-zoru-brand" />
                                Quick Tips
                            </ZoruCardTitle>
                            <ZoruCardDescription>Best practices for awards</ZoruCardDescription>
                        </ZoruCardHeader>
                        <ZoruCardContent>
                            <ul className="flex flex-col gap-3 text-sm text-zoru-ink-muted">
                                <li>
                                    <strong className="text-zoru-ink font-medium">Be specific:</strong> Define clear criteria to avoid ambiguity in nominations.
                                </li>
                                <li>
                                    <strong className="text-zoru-ink font-medium">Meaningful prizes:</strong> Choose rewards that genuinely motivate your team.
                                </li>
                                <li>
                                    <strong className="text-zoru-ink font-medium">Right frequency:</strong> Balance between making it achievable and maintaining exclusivity.
                                </li>
                            </ul>
                        </ZoruCardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
