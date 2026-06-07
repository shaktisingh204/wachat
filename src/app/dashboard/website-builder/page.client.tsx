'use client';

import { Card, CardBody, CardDescription, CardFooter, CardHeader, CardTitle, Button, Skeleton, Input, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Alert, AlertTitle, AlertDescription } from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback,
  useMemo,
} from 'react';
import { getSites } from '@/app/actions/portfolio.actions';
import type { WithId, Website } from '@/lib/definitions';

import { ArrowRight, Globe, Search, ExternalLink, AlertCircle, RefreshCw } from 'lucide-react';
import { CreatePortfolioDialog } from '@/components/20ui-domain/create-portfolio-dialog';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';

function PageSkeleton() {
    return (
        <div className="space-y-6 max-w-7xl mx-auto w-full">
            <div className="flex justify-between items-center">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-4 w-96" />
                </div>
                <div className="flex gap-2">
                    <Skeleton className="h-10 w-10" />
                    <Skeleton className="h-10 w-40" />
                </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full sm:w-48" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
            </div>
        </div>
    );
}

function SiteCard({ site }: { site: WithId<Website> }) {
    const router = useRouter();
    
    const handleManage = () => {
        router.push(`/dashboard/website-builder/manage/${site._id.toString()}/builder`);
    };

    const handleViewLive = (e: React.MouseEvent) => {
        e.stopPropagation();
        window.open(site.customDomain ? `https://${site.customDomain}` : `/web/${site.slug}`, '_blank');
    };

    return (
        <Card className="flex flex-col h-full hover:shadow-md transition-shadow">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-xl">{site.name}</CardTitle>
                        <CardDescription className="mt-1">
                            Slug: <span className="font-mono bg-[var(--st-bg-muted)] px-1 py-0.5 rounded text-xs">{site.slug}</span>
                        </CardDescription>
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleViewLive} title="View Live Site">
                        <ExternalLink className="h-4 w-4 text-[var(--st-text-secondary)]" />
                    </Button>
                </div>
            </CardHeader>
            <CardBody className="flex-grow">
                <div className="flex flex-col gap-2">
                    <p className="text-sm text-[var(--st-text-secondary)] flex items-center gap-2">
                        Created: <time dateTime={new Date(site.createdAt).toISOString()} suppressHydrationWarning>{format(new Date(site.createdAt), 'MMM dd, yyyy')}</time>
                    </p>
                    <p className="text-sm text-[var(--st-text-secondary)] flex items-center gap-2">
                        Last Updated: <time dateTime={new Date(site.updatedAt).toISOString()} suppressHydrationWarning>{format(new Date(site.updatedAt), 'MMM dd, yyyy')}</time>
                    </p>
                </div>
            </CardBody>
            <CardFooter>
                 <Button onClick={handleManage} className="w-full">
                    Manage Builder <ArrowRight className="ml-2 h-4 w-4"/>
                </Button>
            </CardFooter>
        </Card>
    );
}

export default function WebsiteBuilderDashboard() {
    const [sites, setSites] = useState<WithId<Website>[]>([]);
    const [isLoading, startLoading] = useTransition();
    const [isFetching, setIsFetching] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filtering & Sorting State
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name-asc' | 'name-desc'>('newest');

    const fetchData = useCallback((silent = false) => {
        if (!silent) setIsFetching(true);
        startLoading(async () => {
            try {
                const data = await getSites();
                setSites(data);
                setError(null);
            } catch (err: any) {
                console.error("Error fetching sites:", err);
                setError(err.message || 'Failed to fetch websites. Please try again later.');
            } finally {
                if (!silent) setIsFetching(false);
            }
        });
    }, []);

    // Initial fetch and real-time polling
    useEffect(() => {
        fetchData();
        const intervalId = setInterval(() => {
            fetchData(true);
        }, 30000); // refresh every 30s silently
        
        return () => clearInterval(intervalId);
    }, [fetchData]);

    const filteredAndSortedSites = useMemo(() => {
        let result = [...sites];

        // Filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(site => 
                site.name.toLowerCase().includes(query) || 
                site.slug.toLowerCase().includes(query)
            );
        }

        // Sort
        result.sort((a, b) => {
            if (sortBy === 'newest') {
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            }
            if (sortBy === 'oldest') {
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            }
            if (sortBy === 'name-asc') {
                return a.name.localeCompare(b.name);
            }
            if (sortBy === 'name-desc') {
                return b.name.localeCompare(a.name);
            }
            return 0;
        });

        return result;
    }, [sites, searchQuery, sortBy]);
    
    if (isFetching && sites.length === 0 && !error) {
        return <PageSkeleton />;
    }
    
    return (
        <div className="flex flex-col gap-8 max-w-7xl mx-auto w-full">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <Globe className="h-8 w-8 text-[var(--st-text)]" />
                        Website Builder
                    </h1>
                    <p className="text-[var(--st-text-secondary)] mt-2">
                        Create, manage, and publish your public-facing websites.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => fetchData()} disabled={isLoading} title="Refresh">
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                    <CreatePortfolioDialog onSuccess={() => fetchData()} />
                </div>
            </div>

            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {(sites.length > 0 || searchQuery) && (
                <div className="flex flex-col sm:flex-row gap-4 items-center bg-[var(--st-bg-secondary)] p-4 rounded-lg border shadow-sm">
                    <div className="relative flex-grow w-full sm:w-auto">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--st-text-secondary)]" />
                        <Input
                            placeholder="Search by name or slug..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 w-full bg-[var(--st-bg-secondary)]"
                        />
                    </div>
                    <div className="w-full sm:w-48 shrink-0">
                        <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
                            <SelectTrigger className="bg-[var(--st-bg-secondary)]">
                                <SelectValue placeholder="Sort by" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="newest">Newest First</SelectItem>
                                <SelectItem value="oldest">Oldest First</SelectItem>
                                <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                                <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            )}

            {!isFetching && sites.length === 0 && !error ? (
                <div className="text-center py-16 text-[var(--st-text-secondary)] border-2 border-dashed rounded-lg bg-[var(--st-bg-secondary)]/50">
                    <Globe className="mx-auto h-12 w-12 text-[var(--st-text-tertiary)]" />
                    <h3 className="mt-4 text-lg font-semibold text-[var(--st-text)]">No Websites Created</h3>
                    <p className="mt-2 text-sm max-w-sm mx-auto">You haven't built any websites yet. Click "Create New Site" to start building your online presence.</p>
                    <div className="mt-6">
                        <CreatePortfolioDialog onSuccess={() => fetchData()} />
                    </div>
                </div>
            ) : filteredAndSortedSites.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredAndSortedSites.map(p => (
                        <SiteCard key={p._id.toString()} site={p} />
                    ))}
                </div>
            ) : (sites.length > 0 && filteredAndSortedSites.length === 0) ? (
                 <div className="text-center py-12 text-[var(--st-text-secondary)] bg-[var(--st-bg-secondary)] rounded-lg border">
                    <Search className="mx-auto h-12 w-12 text-[var(--st-text-tertiary)]" />
                    <h3 className="mt-4 text-lg font-medium text-[var(--st-text)]">No results found</h3>
                    <p className="mt-1 text-sm">No websites match your current search.</p>
                    <Button variant="link" onClick={() => setSearchQuery('')} className="mt-4">
                        Clear search
                    </Button>
                </div>
            ) : null}
        </div>
    );
}
