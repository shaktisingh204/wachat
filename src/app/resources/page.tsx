import type { Metadata } from 'next';
import ResourcesClient from './ResourcesClient';

export const dynamic = 'force-dynamic';


export const metadata: Metadata = {
  title: 'Resources | SabNode',
  description: 'Explore our collection of blogs, whitepapers, guides, and videos.',
};

export default function ResourcesPage() {
  return <ResourcesClient />;
}
