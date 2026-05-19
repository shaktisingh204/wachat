import {
    Award,
    BookOpen,
    Briefcase,
    Building2,
    CalendarClock,
    ClipboardCheck,
    ClipboardList,
    Compass,
    FileSignature,
    FileText,
    FileWarning,
    Gauge,
    Gift,
    GraduationCap,
    HandCoins,
    Handshake,
    ListChecks,
    LogOut,
    Megaphone,
    MessageSquare,
    Network,
    PackageOpen,
    PlaneTakeoff,
    Sparkles,
    Target,
    TrendingUp,
    UserCheck,
    UserPlus,
    Users,
} from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';

import {
    HubKpiGrid,
    HubQuickLinkGrid,
    HubRecentList,
    type HubKpi,
    type HubQuickLink,
    type HubRecentRow,
} from '../_components/hub-kpi-grid';
import {
    countByUser,
    formatDate,
    recentByUser,
} from '../_components/hub-data';

export const dynamic = 'force-dynamic';

interface CandidateDoc {
    _id: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    stage?: string;
    status?: string;
    createdAt?: string;
}

const QUICK_LINKS: HubQuickLink[] = [
    { href: '/dashboard/crm/hr/directory', title: 'Employee Directory', description: 'Full org directory with contact information.', icon: Users },
    { href: '/dashboard/crm/hr/org-chart', title: 'Org Chart', description: 'Reporting hierarchy visualisation.', icon: Network },
    { href: '/dashboard/crm/hr/timesheets', title: 'Timesheets', description: 'Time entries logged by employees.', icon: ClipboardCheck },
    { href: '/dashboard/crm/hr/jobs', title: 'Job Openings', description: 'Open roles and their hiring pipelines.', icon: Briefcase },
    { href: '/dashboard/crm/hr/candidates', title: 'Candidates', description: 'Applicants for open roles.', icon: UserPlus },
    { href: '/dashboard/crm/hr/interviews', title: 'Interviews', description: 'Scheduled interviews and feedback.', icon: MessageSquare },
    { href: '/dashboard/crm/hr/offers', title: 'Offers', description: 'Offers extended to candidates.', icon: Handshake },
    { href: '/dashboard/crm/hr/onboarding', title: 'Onboarding', description: 'New-hire onboarding workflows.', icon: PackageOpen },
    { href: '/dashboard/crm/hr/welcome-kit', title: 'Welcome Kit', description: 'Items issued to new joiners.', icon: Gift },
    { href: '/dashboard/crm/hr/probation', title: 'Probation', description: 'Employees on probation and review dates.', icon: Compass },
    { href: '/dashboard/crm/hr/careers-page', title: 'Careers Page', description: 'Public-facing careers page configuration.', icon: Building2 },
    { href: '/dashboard/crm/hr/documents', title: 'Documents', description: 'Employee documents — IDs, contracts, certificates.', icon: FileText },
    { href: '/dashboard/crm/hr/document-templates', title: 'Document Templates', description: 'Reusable templates for HR documents.', icon: FileSignature },
    { href: '/dashboard/crm/hr/policies', title: 'Policies', description: 'Company policies and acknowledgements.', icon: ClipboardList },
    { href: '/dashboard/crm/hr/announcements', title: 'Announcements', description: 'HR announcements to the org.', icon: Megaphone },
    { href: '/dashboard/crm/hr/training', title: 'Training', description: 'Training programs and sessions.', icon: GraduationCap },
    { href: '/dashboard/crm/hr/learning-paths', title: 'Learning Paths', description: 'Curriculums of training modules.', icon: BookOpen },
    { href: '/dashboard/crm/hr/certifications', title: 'Certifications', description: 'Certifications held by employees.', icon: Award },
    { href: '/dashboard/crm/hr/okrs', title: 'OKRs', description: 'Objectives and key results per team.', icon: Target },
    { href: '/dashboard/crm/hr/feedback-360', title: 'Feedback 360°', description: '360° feedback cycles.', icon: TrendingUp },
    { href: '/dashboard/crm/hr/one-on-ones', title: 'One-on-Ones', description: 'Manager ↔ direct-report 1:1s.', icon: MessageSquare },
    { href: '/dashboard/crm/hr/surveys', title: 'Surveys', description: 'Employee surveys and pulse checks.', icon: ClipboardList },
    { href: '/dashboard/crm/hr/compensation-bands', title: 'Compensation Bands', description: 'Salary bands by role and level.', icon: HandCoins },
    { href: '/dashboard/crm/hr/recognition', title: 'Recognition', description: 'Peer-to-peer recognition and kudos.', icon: Sparkles },
    { href: '/dashboard/crm/hr/succession', title: 'Succession', description: 'Succession planning for key roles.', icon: TrendingUp },
    { href: '/dashboard/crm/hr/disciplinary', title: 'Disciplinary', description: 'Disciplinary cases and warnings.', icon: FileWarning },
    { href: '/dashboard/crm/hr/expense-claims', title: 'Expense Claims', description: 'Employee expense reimbursement claims.', icon: HandCoins },
    { href: '/dashboard/crm/hr/travel', title: 'Travel', description: 'Business travel requests and itineraries.', icon: PlaneTakeoff },
    { href: '/dashboard/crm/hr/assets', title: 'Assets', description: 'IT and equipment asset inventory.', icon: Gauge },
    { href: '/dashboard/crm/hr/asset-assignments', title: 'Asset Assignments', description: 'Assets currently assigned to employees.', icon: ListChecks },
    { href: '/dashboard/crm/hr/exits', title: 'Exits', description: 'Offboarding workflows and checklists.', icon: LogOut },
];

export default async function CrmHrHubPage() {
    const [headcount, openJobs, pendingOnboardings, leaveToday, recentCandidates] = await Promise.all([
        countByUser('crm_employees', { status: 'Active' }),
        countByUser('hr_job_postings', { status: { $in: ['open', 'draft', ''] } }),
        countByUser('crm_onboarding', { status: { $in: ['pending', 'in_progress'] } }),
        countByUser('crm_leave_requests', { status: 'approved', startDate: { $lte: new Date() }, endDate: { $gte: new Date() } }),
        recentByUser<CandidateDoc>('hr_candidates', { sortField: 'createdAt', limit: 5 }),
    ]);

    const kpis: HubKpi[] = [
        {
            label: 'Headcount',
            value: headcount.toLocaleString(),
            icon: Users,
            href: '/dashboard/crm/hr/directory',
        },
        {
            label: 'Open Positions',
            value: openJobs,
            icon: Briefcase,
            tone: openJobs > 0 ? 'warning' : 'default',
            href: '/dashboard/crm/hr/jobs?status=open',
        },
        {
            label: 'Pending Onboardings',
            value: pendingOnboardings,
            icon: UserCheck,
            tone: pendingOnboardings > 0 ? 'warning' : 'default',
            href: '/dashboard/crm/hr/onboarding',
        },
        {
            label: 'On Leave Today',
            value: leaveToday,
            icon: CalendarClock,
            href: '/dashboard/crm/hr/leave',
        },
    ];

    const recentRows: HubRecentRow[] = recentCandidates.map((c) => ({
        id: String(c._id),
        primary: c.name || [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Candidate',
        secondary: c.stage || c.status || '—',
        trailing: formatDate(c.createdAt),
        href: `/dashboard/crm/hr/candidates/${c._id}`,
    }));

    return (
        <EntityListShell
            title="HR"
            subtitle="People operations — directory, hiring, performance, learning, and exits."
        >
            <div className="flex flex-col gap-6">
                <HubKpiGrid kpis={kpis} />
                <HubQuickLinkGrid links={QUICK_LINKS} />
                <HubRecentList
                    title="Recent candidates"
                    rows={recentRows}
                    emptyHint="No candidates yet — post a job from Job Openings."
                    viewAllHref="/dashboard/crm/hr/candidates"
                />
            </div>
        </EntityListShell>
    );
}
