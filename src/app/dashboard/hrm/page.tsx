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
  ShieldCheck,
  Route,
  Gauge,
  Heart,
  LogOut,
  Network,
  Users2,
  CalendarClock,
  DollarSign,
  FileCheck,
  BarChart2,
  Building2,
  CreditCard,
  FileSpreadsheet,
  UserCog,
  Repeat,
  Settings,
} from 'lucide-react';

import { CrmModuleOverview } from '@/app/dashboard/crm/_components/crm-module-overview';

export default function HrmOverviewPage() {
  return (
    <CrmModuleOverview
      title="HR Management"
      subtitle="Hiring, onboarding, performance, payroll, and everything people-related — in one place."
      icon={Users}
      sections={[
        // Recruitment
        { href: '/dashboard/hrm/hr/jobs', label: 'Job Postings', description: 'Open roles, JDs, and hiring pipelines.', icon: Briefcase },
        { href: '/dashboard/hrm/hr/candidates', label: 'Candidates', description: 'Applicant tracking with stages.', icon: Target },
        { href: '/dashboard/hrm/hr/interviews', label: 'Interviews', description: 'Rounds, schedules, and feedback.', icon: Calendar },
        { href: '/dashboard/hrm/hr/offers', label: 'Offers', description: 'Offer letters and acceptance tracking.', icon: Send },
        { href: '/dashboard/hrm/hr/careers-page', label: 'Careers Page', description: 'Configure your public careers page.', icon: Globe },

        // Onboarding & People
        { href: '/dashboard/hrm/hr/onboarding', label: 'Onboarding', description: 'Checklists for smooth new-hire starts.', icon: UserCheck },
        { href: '/dashboard/hrm/hr/welcome-kit', label: 'Welcome Kits', description: 'Standardized welcome materials.', icon: Heart },
        { href: '/dashboard/hrm/hr/probation', label: 'Probation Tracker', description: 'Monitor probation periods and reviews.', icon: ShieldCheck },
        { href: '/dashboard/hrm/hr/directory', label: 'Employee Directory', description: 'Searchable people directory.', icon: Users },
        { href: '/dashboard/hrm/hr/org-chart', label: 'Org Chart', description: 'Visualize the reporting hierarchy.', icon: Network },

        // Payroll & Compliance
        { href: '/dashboard/hrm/payroll/employees', label: 'Employees', description: 'Employee records, roles, and profiles.', icon: Users2 },
        { href: '/dashboard/hrm/payroll/payroll', label: 'Payroll', description: 'Run and manage monthly payroll.', icon: DollarSign },
        { href: '/dashboard/hrm/payroll/payslips', label: 'Payslips', description: 'Generate and distribute payslips.', icon: FileSpreadsheet },
        { href: '/dashboard/hrm/payroll/attendance', label: 'Attendance', description: 'Track daily attendance and punch-ins.', icon: CalendarClock },
        { href: '/dashboard/hrm/payroll/leave', label: 'Leave Management', description: 'Leave requests, balances, and calendar.', icon: Calendar },
        { href: '/dashboard/hrm/payroll/salary-structure', label: 'Salary Structure', description: 'Salary components and pay grades.', icon: CreditCard },

        // Shifts & Time
        { href: '/dashboard/hrm/payroll/shifts', label: 'Shifts', description: 'Define and manage work shifts.', icon: Clock },
        { href: '/dashboard/hrm/payroll/shift-rotations', label: 'Shift Rotations', description: 'Rotation schedules and automation.', icon: Repeat },
        { href: '/dashboard/hrm/payroll/shift-change-requests', label: 'Shift Change Requests', description: 'Employee shift swap requests.', icon: Repeat },

        // Compliance
        { href: '/dashboard/hrm/payroll/pf-esi', label: 'PF & ESI', description: 'Provident Fund and ESI contributions.', icon: ShieldCheck },
        { href: '/dashboard/hrm/payroll/tds', label: 'TDS', description: 'Tax deducted at source management.', icon: FileCheck },
        { href: '/dashboard/hrm/payroll/professional-tax', label: 'Professional Tax', description: 'State professional tax tracking.', icon: FileText },
        { href: '/dashboard/hrm/payroll/form-16', label: 'Form 16', description: 'Annual TDS certificate for employees.', icon: FileText },

        // Departments & Structure
        { href: '/dashboard/hrm/payroll/departments', label: 'Departments', description: 'Org departments and hierarchy.', icon: Building2 },
        { href: '/dashboard/hrm/payroll/designations', label: 'Designations', description: 'Job titles and role ladder.', icon: UserCog },
        { href: '/dashboard/hrm/payroll/holidays', label: 'Holiday Calendar', description: 'Annual holidays and closures.', icon: Calendar },

        // Performance & Growth
        { href: '/dashboard/hrm/hr/okrs', label: 'OKRs & Goals', description: 'Objectives with key results.', icon: Target },
        { href: '/dashboard/hrm/hr/feedback-360', label: '360 Feedback', description: 'Multi-source feedback collection.', icon: Star },
        { href: '/dashboard/hrm/payroll/appraisal-reviews', label: 'Appraisal Reviews', description: 'Performance appraisal cycles.', icon: BarChart2 },
        { href: '/dashboard/hrm/payroll/kpi-tracking', label: 'KPI Tracking', description: 'Track team and individual KPIs.', icon: Gauge },
        { href: '/dashboard/hrm/payroll/goal-setting', label: 'Goal Setting', description: 'Individual and team goal management.', icon: Target },

        // Learning & Culture
        { href: '/dashboard/hrm/hr/training', label: 'Training Programs', description: 'Schedule and track training.', icon: BookOpen },
        { href: '/dashboard/hrm/hr/certifications', label: 'Certifications', description: 'Employee certs and expirations.', icon: Award },
        { href: '/dashboard/hrm/hr/learning-paths', label: 'Learning Paths', description: 'Curated skill-building journeys.', icon: Route },
        { href: '/dashboard/hrm/hr/recognition', label: 'Recognition', description: 'Kudos, awards, and appreciation.', icon: Award },
        { href: '/dashboard/hrm/hr/surveys', label: 'Surveys & Pulse', description: 'Employee engagement surveys.', icon: Gauge },
        { href: '/dashboard/hrm/hr/one-on-ones', label: 'One-on-Ones', description: 'Manager and report check-ins.', icon: MessagesSquare },

        // Documents & Assets
        { href: '/dashboard/hrm/hr/documents', label: 'Employee Documents', description: 'IDs, contracts, NDAs, and more.', icon: FileText },
        { href: '/dashboard/hrm/hr/document-templates', label: 'Document Templates', description: 'Reusable HR document templates.', icon: ClipboardList },
        { href: '/dashboard/hrm/hr/assets', label: 'Asset Register', description: 'Laptops, phones, and equipment.', icon: Package },
        { href: '/dashboard/hrm/hr/asset-assignments', label: 'Asset Assignments', description: 'Who has what, and when.', icon: Layers },

        // Expenses & Travel
        { href: '/dashboard/hrm/hr/timesheets', label: 'Timesheets', description: 'Weekly time logging and approval.', icon: Clock },
        { href: '/dashboard/hrm/hr/travel', label: 'Travel Requests', description: 'Business travel approvals.', icon: Plane },
        { href: '/dashboard/hrm/hr/expense-claims', label: 'Expense Claims', description: 'Reimbursement tracking.', icon: Wallet },

        // Reports & Exit
        { href: '/dashboard/hrm/payroll/reports', label: 'Payroll Reports', description: 'Attendance, leave, and salary reports.', icon: BarChart2 },
        { href: '/dashboard/hrm/hr/compensation-bands', label: 'Compensation Bands', description: 'Salary ranges by level.', icon: LineChart },
        { href: '/dashboard/hrm/hr/exits', label: 'Exit Management', description: 'Resignations and F&F.', icon: LogOut },
        { href: '/dashboard/hrm/hr/succession', label: 'Succession Plans', description: 'Future leaders pipeline.', icon: UserPlus },
        { href: '/dashboard/hrm/hr/announcements', label: 'Announcements', description: 'Broadcast news across the company.', icon: Megaphone },
        { href: '/dashboard/hrm/hr/policies', label: 'Policy Library', description: 'HR policies and handbooks.', icon: FileText },

        // Settings
        { href: '/dashboard/hrm/payroll/settings', label: 'HRM Settings', description: 'Configure HRM preferences and rules.', icon: Settings },
      ]}
    />
  );
}
