import { ZoruCard, ZoruPageDescription, ZoruPageHeader, ZoruPageHeading, ZoruPageTitle } from '@/components/zoruui';
import {
  ArrowUpRight,
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
  Stethoscope,
  Target,
  TrendingUp,
  UserPlus,
  Users,
  } from 'lucide-react';

/**
 * HR module overview — tile grid linking every sub-feature.
 *
 * Was a `redirect('/dashboard/crm/hr/directory')` shim.
 */

import Link from 'next/link';

interface NavTile {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const tiles: NavTile[] = [
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

export default function CrmHrHubPage() {
  return (
    <div className="flex min-h-full flex-col gap-6 p-4 sm:p-6">
      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>HR</ZoruPageTitle>
          <ZoruPageDescription>
            People operations — directory, hiring, performance, learning, and exits.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </ZoruPageHeader>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <Link key={tile.href} href={tile.href} className="group">
              <ZoruCard className="h-full p-5 transition-shadow group-hover:shadow-[var(--zoru-shadow-md)]">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2 text-zoru-ink">
                  <Icon className="h-[18px] w-[18px]" />
                </div>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[14px] font-medium text-zoru-ink">{tile.title}</p>
                  <ArrowUpRight className="h-4 w-4 text-zoru-ink-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-zoru-ink" />
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-zoru-ink-muted">
                  {tile.description}
                </p>
              </ZoruCard>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
