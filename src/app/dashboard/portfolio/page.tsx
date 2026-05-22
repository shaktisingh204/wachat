'use client';

import {
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardFooter,
  ZoruCardHeader,
  ZoruCardTitle,
  EmptyState,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Skeleton,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight,
  Globe } from 'lucide-react';

import { getSites } from '@/app/actions/portfolio.actions';
import type { WithId,
  Website } from '@/lib/definitions';
import { CreatePortfolioDialog } from '@/components/wabasimplify/create-portfolio-dialog';

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    </div>
  );
}

function SiteCard({ site }: { site: WithId<Website> }) {
  const router = useRouter();
  const handleManage = () => {
    router.push(`/dashboard/website-builder/manage/${site._id.toString()}/builder`);
  };

  return (
    <Card className="flex flex-col">
      <ZoruCardHeader>
        <ZoruCardTitle>{site.name}</ZoruCardTitle>
        <ZoruCardDescription>Slug: {site.slug}</ZoruCardDescription>
      </ZoruCardHeader>
      <ZoruCardContent className="flex-grow">
        <p className="text-sm text-zoru-ink-muted">
          Created: {new Date(site.createdAt).toLocaleDateString()}
        </p>
      </ZoruCardContent>
      <ZoruCardFooter>
        <Button onClick={handleManage} block>
          Manage <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </ZoruCardFooter>
    </Card>
  );
}

export default function WebsiteBuilderDashboard() {
  const [sites, setSites] = useState<WithId<Website>[]>([]);
  const [isLoading, startLoading] = useTransition();

  const fetchData = useCallback(() => {
    startLoading(async () => {
      const data = await getSites();
      setSites(data);
    });
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader>
          <ZoruPageHeading>
            <ZoruPageTitle>
              <span className="inline-flex items-center gap-3">
                <Globe className="h-7 w-7" />
                Website builder
              </span>
            </ZoruPageTitle>
            <ZoruPageDescription>
              Create and manage your public-facing websites.
            </ZoruPageDescription>
          </ZoruPageHeading>
        </PageHeader>
        <CreatePortfolioDialog onSuccess={fetchData} />
      </div>

      {sites.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sites.map((p) => (
            <SiteCard key={p._id.toString()} site={p} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Globe className="h-12 w-12" />}
          title="No websites created"
          description={`Click "Create new site" to get started.`}
        />
      )}
    </div>
  );
}
