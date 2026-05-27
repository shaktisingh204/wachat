'use client';
import { fmtDate } from "@/lib/utils";

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
} from '@/components/zoruui';
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
import { CreatePortfolioDialog } from '@/components/zoruui-domain/create-portfolio-dialog';
import { toast } from 'sonner';

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
        <Button variant="outline" size="sm" className="w-full mt-2">
          <LinkIcon className="mr-2 h-4 w-4" />
          {site.customDomain ? 'Manage Domain' : 'Link Custom Domain'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Domain Mapping</DialogTitle>
          <DialogDescription>
            Map a custom domain to your website. E.g. www.example.com
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="customDomain">Custom Domain</Label>
              <Input 
                id="customDomain" 
                name="customDomain" 
                defaultValue={site.customDomain || ''} 
                placeholder="e.g. www.example.com" 
              />
            </div>
            {site.customDomain && (
              <div className="text-sm text-zoru-ink-muted bg-zoru-surface-hover p-3 rounded-md">
                <strong>Important:</strong> Please ensure you have added a CNAME or A record in your DNS settings pointing to our servers before linking.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save Domain'}
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
    router.push(`/dashboard/website-builder/manage/${site._id.toString()}/builder`);
  };

  return (
    <Card className="flex flex-col">
      <ZoruCardHeader>
        <ZoruCardTitle>{site.name}</ZoruCardTitle>
        <ZoruCardDescription>Slug: {site.slug}</ZoruCardDescription>
      </ZoruCardHeader>
      <ZoruCardContent className="flex-grow space-y-4">
        <div>
          <p className="text-sm text-zoru-ink-muted">
            Created: {fmtDate(site.createdAt)}
          </p>
          {site.customDomain && (
            <p className="text-sm font-medium mt-1">
              Domain: <a href={`https://${site.customDomain}`} target="_blank" rel="noreferrer" className="text-zoru-brand hover:underline">{site.customDomain}</a>
            </p>
          )}
        </div>
        <DomainMappingDialog site={site} onUpdate={onUpdate} />
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
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading) return <PageSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col gap-8">
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
        <div className="p-4 bg-zoru-surface-2 text-zoru-ink rounded-md border border-zoru-line">
          <p className="font-semibold">Error</p>
          <p>{error}</p>
          <Button variant="outline" className="mt-4" onClick={fetchData}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

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
            <SiteCard key={p._id.toString()} site={p} onUpdate={fetchData} />
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

