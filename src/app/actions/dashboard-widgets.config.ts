export type DashboardType =
  | 'overview'
  | 'project'
  | 'client'
  | 'hr'
  | 'ticket'
  | 'finance';

export type WidgetKey =
  | 'project-status-counts'
  | 'today-tasks'
  | 'open-tickets'
  | 'active-timer'
  | 'week-timelog'
  | 'pending-leaves'
  | 'upcoming-birthdays'
  | 'latest-discussions'
  | 'recent-notices'
  | 'upcoming-events'
  | 'top-projects'
  | 'revenue-mtd'
  | 'expense-mtd'
  | 'pending-invoices'
  | 'new-leads'
  | 'won-deals'
  | 'upcoming-followups'
  | 'activity-feed'
  | 'calendar'
  | 'sticky-notes'
  | 'my-team';

export type WidgetPref = {
  widgetKey: WidgetKey;
  label: string;
  description: string;
  enabled: boolean;
  position: number;
};

export const AVAILABLE_WIDGETS: Array<{
  key: WidgetKey;
  label: string;
  description: string;
  defaultDashboards: DashboardType[];
}> = [
  { key: 'project-status-counts', label: 'Project status counts', description: 'In-progress / on-hold / completed', defaultDashboards: ['overview', 'project'] },
  { key: 'today-tasks', label: "Today's tasks", description: 'Your tasks due today', defaultDashboards: ['overview', 'project'] },
  { key: 'open-tickets', label: 'Open tickets', description: 'Tickets assigned to you', defaultDashboards: ['overview', 'ticket'] },
  { key: 'active-timer', label: 'Active timer', description: 'Currently running time entry', defaultDashboards: ['overview'] },
  { key: 'week-timelog', label: 'This week’s time log', description: 'Hours logged across projects', defaultDashboards: ['overview', 'hr'] },
  { key: 'pending-leaves', label: 'Pending leaves', description: 'Leave requests to approve', defaultDashboards: ['hr'] },
  { key: 'upcoming-birthdays', label: 'Upcoming birthdays', description: 'Team birthdays this month', defaultDashboards: ['hr'] },
  { key: 'latest-discussions', label: 'Latest discussions', description: 'Project discussion activity', defaultDashboards: ['overview', 'project'] },
  { key: 'recent-notices', label: 'Recent notices', description: 'Company notices', defaultDashboards: ['hr'] },
  { key: 'upcoming-events', label: 'Upcoming events', description: 'Calendar events this week', defaultDashboards: ['overview'] },
  { key: 'top-projects', label: 'Top projects', description: 'Most active projects', defaultDashboards: ['project'] },
  { key: 'revenue-mtd', label: 'Revenue (MTD)', description: 'Month-to-date revenue', defaultDashboards: ['finance', 'overview'] },
  { key: 'expense-mtd', label: 'Expense (MTD)', description: 'Month-to-date expenses', defaultDashboards: ['finance'] },
  { key: 'pending-invoices', label: 'Pending invoices', description: 'Unpaid invoice count', defaultDashboards: ['finance', 'client'] },
  { key: 'new-leads', label: 'New leads', description: 'Leads added this week', defaultDashboards: ['overview'] },
  { key: 'won-deals', label: 'Won deals', description: 'Deals closed-won', defaultDashboards: ['overview', 'finance'] },
  { key: 'upcoming-followups', label: 'Upcoming follow-ups', description: 'Scheduled follow-up reminders', defaultDashboards: ['overview'] },
  { key: 'activity-feed', label: 'Activity feed', description: 'Recent activity across the CRM', defaultDashboards: ['overview'] },
  { key: 'calendar', label: 'Calendar', description: 'Inline calendar widget', defaultDashboards: ['overview'] },
  { key: 'sticky-notes', label: 'Sticky notes', description: 'Personal quick notes', defaultDashboards: ['overview'] },
  { key: 'my-team', label: 'My team', description: 'Direct reports + their open work', defaultDashboards: ['overview', 'hr'] },
];
