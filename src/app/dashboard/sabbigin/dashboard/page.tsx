import { redirect } from 'next/navigation';

/** Legacy single dashboard → the customizable dashboards hub. */
export default function SabbiginDashboardRedirect() {
  redirect('/dashboard/sabbigin/dashboards');
}
