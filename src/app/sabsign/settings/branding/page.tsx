import { getSabsignBranding } from '@/app/actions/sabsign-settings.actions';

import { BrandingClient } from './_client';

export const dynamic = 'force-dynamic';

export default async function SabsignBrandingPage() {
  const branding = await getSabsignBranding();
  return <BrandingClient initial={branding} />;
}
