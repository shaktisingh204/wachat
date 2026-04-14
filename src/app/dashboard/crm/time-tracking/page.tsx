import {
  Clock,
  PlayCircle,
  CalendarRange,
  Settings,
  BarChart3,
} from 'lucide-react';

import { CrmModuleOverview } from '../_components/crm-module-overview';

export default function TimeTrackingOverviewPage() {
  return (
    <CrmModuleOverview
      title="Time Tracking"
      subtitle="Log project time, manage breaks, approve weekly timesheets, and report on effort across your team."
      icon={Clock}
      sections={[
        {
          href: '/dashboard/crm/time-tracking/time-logs',
          label: 'Time Logs',
          description:
            'Start and stop timers, log time against projects and tasks, approve or reject entries.',
          icon: PlayCircle,
        },
        {
          href: '/dashboard/crm/time-tracking/weekly-timesheets',
          label: 'Weekly Timesheets',
          description:
            'Grid of tasks × days for fast bulk entry — submit, approve, and track weekly effort.',
          icon: CalendarRange,
        },
        {
          href: '/dashboard/crm/time-tracking/reports',
          label: 'Reports',
          description:
            'Group logged time by employee, project, or date with exportable totals.',
          icon: BarChart3,
        },
        {
          href: '/dashboard/crm/time-tracking/settings',
          label: 'Settings',
          description:
            'Configure whether time is logged against projects only, tasks only, or both.',
          icon: Settings,
        },
      ]}
    />
  );
}
