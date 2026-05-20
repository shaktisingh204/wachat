import { redirect } from 'next/navigation';

// Moved under wachat. Keep this stub for old bookmarks / OAuth redirects.
export default function LegacySetupRedirect() {
  redirect('/dashboard/wachat/setup');
}
