import { Clock3, ListChecks, CalendarClock, BarChart3, Settings2 } from 'lucide-react';
import { CrmModuleOverview } from '../_components/crm-module-overview';

export default function TimeTrackingPage() {
  return (
    <CrmModuleOverview
      title="Time Tracking"
      subtitle="Log work items, review timesheet status, and export time-tracking data from the CRM workspace."
      icon={Clock3}
      sections={[
        {
          href: '/dashboard/crm/time-tracking/time-logs',
          label: 'Time Logs',
          description: 'Start/stop timers, add manual entries, and review all logged time per project or task.',
          icon: ListChecks,
        },
        {
          href: '/dashboard/crm/time-tracking/weekly-timesheets',
          label: 'Weekly Timesheets',
          description: 'View and approve weekly timesheet summaries per team member.',
          icon: CalendarClock,
        },
        {
          href: '/dashboard/crm/time-tracking/reports',
          label: 'Reports',
          description: 'Summarise billable vs. non-billable hours, project utilisation, and export to CSV.',
          icon: BarChart3,
        },
        {
          href: '/dashboard/crm/time-tracking/settings',
          label: 'Settings',
          description: 'Configure rounding rules, billable defaults, and approval workflows.',
          icon: Settings2,
        },
      ]}
    />
  );
}
