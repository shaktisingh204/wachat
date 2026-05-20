'use client';

/**
 * PortalShell — the client root of the Employee Self-Service Portal.
 *
 * Receives all data as props from the server page (no client-side fetches
 * on mount). Refresh is triggered via router.refresh() after mutations.
 *
 * Section switching uses a segmented button group (no-tab-ui compliant).
 */

import { useState, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/components/zoruui';
import type {
    PortalEmployeeProfile,
    PortalTeamMember,
    PortalTask,
    PortalKpis,
} from '@/app/actions/hrm-portal.actions';

import { ProfileCard } from './profile-card';
import { KpiStrip } from './kpi-strip';
import { TeamGrid } from './team-grid';
import { MyTasksTable, MyCreatedTasksTable } from './tasks-panel';
import { Users, ClipboardList, ClipboardCheck } from 'lucide-react';

interface PortalShellProps {
    profile: PortalEmployeeProfile;
    kpis: PortalKpis;
    team: PortalTeamMember[];
    myTasks: PortalTask[];
    createdTasks: PortalTask[];
}

type Section = 'team' | 'my-tasks' | 'created-tasks';

interface SectionDef {
    id: Section;
    label: string;
    icon: React.ReactNode;
}

const SECTIONS: SectionDef[] = [
    { id: 'team', label: 'My Team', icon: <Users className="h-3.5 w-3.5 shrink-0" /> },
    { id: 'my-tasks', label: 'Tasks Assigned to Me', icon: <ClipboardList className="h-3.5 w-3.5 shrink-0" /> },
    { id: 'created-tasks', label: 'Tasks I Assigned', icon: <ClipboardCheck className="h-3.5 w-3.5 shrink-0" /> },
];

export function PortalShell({
    profile,
    kpis,
    team,
    myTasks,
    createdTasks,
}: PortalShellProps) {
    const router = useRouter();
    const [activeSection, setActiveSection] = useState<Section>('team');
    const [, startTransition] = useTransition();

    const refresh = useCallback(() => {
        startTransition(() => {
            router.refresh();
        });
    }, [router]);

    return (
        <div className="flex flex-col gap-6 p-4 md:p-6 max-w-[1280px] mx-auto">
            {/* Profile card */}
            <ProfileCard profile={profile} />

            {/* KPI strip */}
            <KpiStrip kpis={kpis} />

            {/* Segmented section switcher */}
            <div
                role="group"
                aria-label="Portal sections"
                className="flex flex-wrap gap-1 rounded-full border border-zoru-line bg-zoru-bg p-1 w-fit"
            >
                {SECTIONS.map((s) => (
                    <button
                        key={s.id}
                        type="button"
                        onClick={() => setActiveSection(s.id)}
                        className={cn(
                            'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors',
                            activeSection === s.id
                                ? 'bg-zoru-ink text-zoru-bg shadow-sm'
                                : 'text-zoru-ink-muted hover:text-zoru-ink hover:bg-zoru-surface-2',
                        )}
                    >
                        {s.icon}
                        {s.label}
                    </button>
                ))}
            </div>

            {/* Section bodies */}
            {activeSection === 'team' && (
                <section>
                    <div className="mb-4">
                        <h3 className="text-[15px] font-semibold text-zoru-ink">My Team</h3>
                        <p className="text-[12.5px] text-zoru-ink-muted">
                            Your direct reports — click a card to assign a task.
                        </p>
                    </div>
                    <TeamGrid members={team} onTaskAssigned={refresh} />
                </section>
            )}

            {activeSection === 'my-tasks' && (
                <section>
                    <div className="mb-4">
                        <h3 className="text-[15px] font-semibold text-zoru-ink">Tasks Assigned to Me</h3>
                        <p className="text-[12.5px] text-zoru-ink-muted">
                            Open tasks you need to complete. Hit &ldquo;Done&rdquo; to mark complete.
                        </p>
                    </div>
                    <MyTasksTable tasks={myTasks} onRefresh={refresh} />
                </section>
            )}

            {activeSection === 'created-tasks' && (
                <section>
                    <div className="mb-4">
                        <h3 className="text-[15px] font-semibold text-zoru-ink">Tasks I Assigned</h3>
                        <p className="text-[12.5px] text-zoru-ink-muted">
                            Open tasks you have delegated to your team.
                        </p>
                    </div>
                    <MyCreatedTasksTable tasks={createdTasks} />
                </section>
            )}
        </div>
    );
}
