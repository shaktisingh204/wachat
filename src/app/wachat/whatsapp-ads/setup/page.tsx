import { permanentRedirect } from 'next/navigation';

/**
 * Wachat WhatsApp Ads Setup - deprecated wizard entry point. The
 * actual setup flow now lives under /dashboard/facebook/all-projects.
 */
export default function DeprecatedWhatsappAdsSetupPage() {
  permanentRedirect('/dashboard/facebook/all-projects');
}
