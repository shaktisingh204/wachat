import type { Metadata } from 'next';
import { MarketingNavPage, marketingPageConfigs } from '@/components/landing/marketing-page';

export const metadata: Metadata = {
  title: 'Partners | SabNode',
  description: 'Partner with SabNode through agency, developer, and referral programs for customer operations.',
};

export default function PartnersPage() {
  return <MarketingNavPage config={marketingPageConfigs.partners} />;
}
