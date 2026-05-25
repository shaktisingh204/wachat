import { SiteExplorerClient } from './_components/site-explorer-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Site Explorer | SabNode',
};

export default function SiteExplorerPage() {
  return <SiteExplorerClient />;
}
