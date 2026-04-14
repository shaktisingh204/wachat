import {
  Users,
  Target,
  UserCheck,
  MessagesSquare,
  FileText,
  BookOpen,
  Star,
  Clock,
  Package,
  Megaphone,
  UserCog,
  Briefcase,
  ClipboardList,
  LineChart,
  Award,
  Send,
  Plane,
  Wallet,
  Calendar,
  Globe,
  Layers,
  UserPlus,
  FileCheck,
  ShieldCheck,
  Route,
  Gauge,
  Heart,
  LogOut,
  UserMinus,
  Network,
} from 'lucide-react';

import { CrmModuleOverview } from '../_components/crm-module-overview';

export default function HrOverviewPage() {
  return (
    <CrmModuleOverview
      title="HR Management"
      subtitle="Hiring, onboarding, performance, learning, and everything people-related — in one place."
      icon={Users}
      sections={[
        // Recruitment
        { href: '/dashboard/crm/hr/jobs', label: 'Job Postings', description: 'Open roles, JDs, and hiring pipelines.', icon: Briefcase },
        { href: '/dashboard/crm/hr/candidates', label: 'Candidates', description: 'Applicant tracking with stages.', icon: Target },
        { href: '/dashboard/crm/hr/interviews', label: 'Interviews', description: 'Rounds, schedules, and feedback.', icon: Calendar },
        { href: '/dashboard/crm/hr/offers', label: 'Offers', description: 'Offer letters and acceptance tracking.', icon: Send },
        { href: '/dashboard/crm/hr/careers-page', label: 'Careers Page', description: 'Configure your public careers page.', icon: Globe },

        // Onboarding
        { href: '/dashboard/crm/hr/onboarding', label: 'Onboarding', description: 'Checklists for smooth new-hire starts.', icon: UserCheck },
        { href: '/dashboard/crm/hr/welcome-kit', label: 'Welcome Kits', description: 'Standardized welcome materials.', icon: Heart },
        { href: '/dashboard/crm/hr/probation', label: 'Probation Tracker', description: 'Monitor probation periods and reviews.', icon: ShieldCheck },

        // Workspace
        { href: '/dashboard/crm/hr/directory', label: 'Employee Directory', description: 'Searchable people directory.', icon: Users },
        { href: '/dashboard/crm/hr/org-chart', label: 'Org Chart', description: 'Visualize the reporting hierarchy.', icon: Network },
        { href: '/dashboard/crm/hr/announcements', label: 'Announcements', description: 'Broadcast news across the company.', icon: Megaphone },
        { href: '/dashboard/crm/hr/policies', label: 'Policy Library', description: 'HR policies and handbooks.', icon: FileText },

        // Documents
        { href: '/dashboard/crm/hr/documents', label: 'Employee Documents', description: 'IDs, contracts, NDAs, and more.', icon: FileText },
        { href: '/dashboard/crm/hr/document-templates', label: 'Document Templates', description: 'Reusable HR document templates.', icon: ClipboardList },

        // Training
        { href: '/dashboard/crm/hr/training', label: 'Training Programs', description: 'Schedule and track training.', icon: BookOpen },
        { href: '/dashboard/crm/hr/certifications', label: 'Certifications', description: 'Employee certs and expirations.', icon: Award },
        { href: '/dashboard/crm/hr/learning-paths', label: 'Learning Paths', description: 'Curated skill-building journeys.', icon: Route },

        // Performance
        { href: '/dashboard/crm/hr/okrs', label: 'OKRs & Goals', description: 'Objectives with key results.', icon: Target },
        { href: '/dashboard/crm/hr/feedback-360', label: '360 Feedback', description: 'Multi-source feedback collection.', icon: Star },
        { href: '/dashboard/crm/hr/one-on-ones', label: 'One-on-Ones', description: 'Manager and report check-ins.', icon: MessagesSquare },

        // Time & Expense
        { href: '/dashboard/crm/hr/timesheets', label: 'Timesheets', description: 'Weekly time logging and approval.', icon: Clock },
        { href: '/dashboard/crm/hr/travel', label: 'Travel Requests', description: 'Business travel approvals.', icon: Plane },
        { href: '/dashboard/crm/hr/expense-claims', label: 'Expense Claims', description: 'Reimbursement tracking.', icon: Wallet },

        // Assets
        { href: '/dashboard/crm/hr/assets', label: 'Asset Register', description: 'Laptops, phones, and equipment.', icon: Package },
        { href: '/dashboard/crm/hr/asset-assignments', label: 'Asset Assignments', description: 'Who has what, and when.', icon: Layers },

        // Engagement
        { href: '/dashboard/crm/hr/recognition', label: 'Recognition', description: 'Kudos, awards, and appreciation.', icon: Award },
        { href: '/dashboard/crm/hr/surveys', label: 'Surveys & Pulse', description: 'Employee engagement surveys.', icon: Gauge },

        // Compensation & Exit
        { href: '/dashboard/crm/hr/compensation-bands', label: 'Compensation Bands', description: 'Salary ranges by level.', icon: LineChart },
        { href: '/dashboard/crm/hr/exits', label: 'Exit Management', description: 'Resignations and F&F.', icon: LogOut },
        { href: '/dashboard/crm/hr/succession', label: 'Succession Plans', description: 'Future leaders pipeline.', icon: UserPlus },
      ]}
    />
  );
}
