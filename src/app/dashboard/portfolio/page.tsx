'use client';
import { fmtDate } from "@/lib/utils";

import {
  Alert,
  Button,
  Callout,
  Card,
  CardBody,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  EmptyState,
  Field,
  Input,
  PageDescription,
  PageHeader,
  PageHeading,
  PageTitle,
  Skeleton,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight,
  Globe,
  Link as LinkIcon } from 'lucide-react';

import { getSites, updateSiteDomain } from '@/app/actions/portfolio.actions';
import type { WithId,
  Website } from '@/lib/definitions';
import { CreatePortfolioDialog } from '@/components/20ui-domain/create-portfolio-dialog';

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

function DomainMappingDialog({ site, onUpdate }: { site: WithId<Website>, onUpdate: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const customDomain = formData.get('customDomain') as string;

    setIsPending(true);
    try {
      const res = await updateSiteDomain(site._id.toString(), customDomain);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(res.message || 'Domain updated.');
        setOpen(false);
        onUpdate();
      }
    } catch (err: any) {
      toast.error(err.message || 'An unexpected error occurred.');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" block className="mt-2" iconLeft={LinkIcon}>
          {site.customDomain ? 'Manage domain' : 'Link custom domain'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Domain mapping</DialogTitle>
          <DialogDescription>
            Map a custom domain to your website. For example, www.example.com
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave}>
          <div className="space-y-4 py-4">
            <Field label="Custom domain">
              <Input
                name="customDomain"
                defaultValue={site.customDomain || ''}
                placeholder="e.g. www.example.com"
              />
            </Field>
            {site.customDomain && (
              <Callout tone="info" title="Important">
                Please ensure you have added a CNAME or A record in your DNS settings pointing to our servers before linking.
              </Callout>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" loading={isPending}>
              {isPending ? 'Saving...' : 'Save domain'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SiteCard({ site, onUpdate }: { site: WithId<Website>, onUpdate: () => void }) {
  const router = useRouter();
  const handleManage = () => {
    router.push(`/dashboard/portfolio/manage/${site._id.toString()}/builder`);
  };

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>{site.name}</CardTitle>
        <CardDescription>Slug: {site.slug}</CardDescription>
      </CardHeader>
      <CardBody className="flex-grow space-y-4">
        <div>
          <p className="text-sm text-[var(--st-text-secondary)]">
            Created: {fmtDate(site.createdAt)}
          </p>
          {site.customDomain && (
            <p className="text-sm font-medium mt-1 text-[var(--st-text)]">
              Domain:{' '}
              <a
                href={`https://${site.customDomain}`}
                target="_blank"
                rel="noreferrer"
                className="text-[var(--st-accent)] hover:underline"
              >
                {site.customDomain}
              </a>
            </p>
          )}
        </div>
        <DomainMappingDialog site={site} onUpdate={onUpdate} />
      </CardBody>
      <CardFooter>
        <Button onClick={handleManage} variant="primary" block iconRight={ArrowRight}>
          Manage
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function WebsiteBuilderDashboard() {
  const { toast } = useToast();
  const [sites, setSites] = useState<WithId<Website>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getSites();
      setSites(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch sites.');
      toast.error('Failed to load your websites.');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading) return <PageSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader>
          <PageHeading>
            <PageTitle>
              <span className="inline-flex items-center gap-3">
                <Globe className="h-7 w-7" aria-hidden="true" />
                Website builder
              </span>
            </PageTitle>
            <PageDescription>
              Create and manage your public-facing websites.
            </PageDescription>
          </PageHeading>
        </PageHeader>
        <Alert tone="danger" title="Error">
          <p>{error}</p>
          <Button variant="outline" className="mt-4" onClick={fetchData}>
            Retry
          </Button>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader>
          <PageHeading>
            <PageTitle>
              <span className="inline-flex items-center gap-3">
                <Globe className="h-7 w-7" aria-hidden="true" />
                Website builder
              </span>
            </PageTitle>
            <PageDescription>
              Create and manage your public-facing websites.
            </PageDescription>
          </PageHeading>
        </PageHeader>
        <CreatePortfolioDialog onSuccess={fetchData} />
      </div>

      {sites.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sites.map((p) => (
            <SiteCard key={p._id.toString()} site={p} onUpdate={fetchData} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Globe}
          title="No websites created"
          description={`Click "Create new site" to get started.`}
        />
      )}
    </div>
  );
}
