'use client';

import { Clock3 } from 'lucide-react';
import { WorkingFeaturePage } from '@/components/dashboard/working-feature-page';

export default function Page() {
  return (
    <WorkingFeaturePage
      title="Time Tracking"
      description="Log work items, review timesheet status, filter owners, and export time-tracking rows from the CRM workspace."
      eyebrow="CRM"
      icon={Clock3}
      accent="#2563EB"
      storageKey="dashboard-crm-time-tracking"
      primaryActionLabel="Add time log"
  quickLinks={[
    {
        "label": "Time logs",
        "href": "/dashboard/crm/time-tracking/time-logs"
    },
    {
        "label": "Weekly timesheets",
        "href": "/dashboard/crm/time-tracking/weekly-timesheets"
    },
    {
        "label": "Reports",
        "href": "/dashboard/crm/time-tracking/reports"
    }
]}
    />
  );
}
