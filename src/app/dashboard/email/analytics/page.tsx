import { redirect } from 'next/navigation';

// Legacy path; analytics moved to /dashboard/email/reports.
export default function EmailAnalyticsRedirect() {
  redirect('/dashboard/email/reports');
}
