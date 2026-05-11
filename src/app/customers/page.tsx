import type { Metadata } from 'next';
import { MarketingNavPage, marketingPageConfigs } from '@/components/landing/marketing-page';

export const metadata: Metadata = {
  title: 'Customers | SabNode',
  description: 'See how customer-facing teams use SabNode to respond faster, automate follow-up, and measure impact.',
};

export default function CustomersPage() {
  return <MarketingNavPage config={marketingPageConfigs.customers} />;
}
