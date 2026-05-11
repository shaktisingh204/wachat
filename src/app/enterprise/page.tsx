import type { Metadata } from 'next';
import { MarketingNavPage, marketingPageConfigs } from '@/components/landing/marketing-page';

export const metadata: Metadata = {
  title: 'Enterprise | SabNode',
  description: 'Enterprise-grade security, governance, support, and scale for customer operations on SabNode.',
};

export default function EnterprisePage() {
  return <MarketingNavPage config={marketingPageConfigs.enterprise} />;
}
