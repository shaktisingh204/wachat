import type { Metadata } from 'next';
import { MarketingNavPage, marketingPageConfigs } from '@/components/landing/marketing-page';

export const metadata: Metadata = {
  title: 'Products | SabNode',
  description: 'Explore the SabNode product suite for conversations, automation, CRM, campaigns, commerce, and analytics.',
};

export default function ProductsPage() {
  return <MarketingNavPage config={marketingPageConfigs.products} />;
}
