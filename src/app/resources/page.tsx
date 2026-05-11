import type { Metadata } from 'next';
import { MarketingNavPage, marketingPageConfigs } from '@/components/landing/marketing-page';

export const metadata: Metadata = {
  title: 'Resources | SabNode',
  description: 'Find SabNode docs, guides, API references, changelog notes, support, and security resources.',
};

export default function ResourcesPage() {
  return <MarketingNavPage config={marketingPageConfigs.resources} />;
}
