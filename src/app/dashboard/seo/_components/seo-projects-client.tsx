'use client';

import { 
    Card, 
    ZoruPageDescription, 
    PageHeader, 
    ZoruPageHeading, 
    ZoruPageTitle, 
    Skeleton, 
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    useZoruToast,
    Button
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useMemo
} from 'react';

import { SeoProjectCard } from '@/components/zoruui-domain/seo-project-card';
import { BarChart, Search, Activity, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { getSeoProjects } from '@/app/actions/seo.actions';
import { CreateSeoProjectDialog } from '@/components/zoruui-domain/seo/create-project-dialog';
import type { SeoProject } from '@/lib/seo/definitions';
import { deleteSeoProject } from '@/app/actions/seo.actions';

export function SeoProjectsClient({ initialProjects }: { initialProjects: SeoProject[] }) {
    const [projects, setProjects] = useState<SeoProject[]>(initialProjects);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('newest');
    const [page, setPage] = useState(1);
    const { toast } = useZoruToast();
    const ITEMS_PER_PAGE = 6;

    useEffect(() => {
        setPage(1);
    }, [searchQuery, sortBy]);

    const handleToggleFavorite = async (id: string, currentStatus: boolean) => {
        try {
            const { toggleSeoProjectFavorite } = await import('@/app/actions/seo.actions');
            await toggleSeoProjectFavorite(id, !currentStatus);
            setProjects(prev => prev.map(p => p._id === id ? { ...p, isFavorite: !currentStatus } : p));
        } catch (e: any) {
            console.error(e);
            toast({ title: "Error", description: e?.message || "Failed to toggle favorite status.", variant: "destructive" });
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await deleteSeoProject(id);
            if (res?.error) {
                toast({ title: "Error", description: res.error, variant: "destructive" });
            } else {
                setProjects(prev => prev.filter(p => p._id !== id));
                toast({ title: "Success", description: "Project deleted successfully." });
            }
        } catch (e: any) {
            console.error(e);
            toast({ title: "Error", description: e?.message || "Failed to delete project.", variant: "destructive" });
        }
    };

    const filteredAndSortedProjects = useMemo(() => {
        let result = [...projects];

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(p => p.domain.toLowerCase().includes(query));
        }

        result.sort((a, b) => {
            // Favorites always on top
            if (a.isFavorite && !b.isFavorite) return -1;
            if (!a.isFavorite && b.isFavorite) return 1;

            if (sortBy === 'newest') {
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            } else if (sortBy === 'oldest') {
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            } else if (sortBy === 'health') {
                return (b.healthScore || 0) - (a.healthScore || 0);
            } else if (sortBy === 'name') {
                return a.domain.localeCompare(b.domain);
            }
            return 0;
        });

        return result;
    }, [projects, searchQuery, sortBy]);

    const totalPages = Math.ceil(filteredAndSortedProjects.length / ITEMS_PER_PAGE);
    const paginatedProjects = filteredAndSortedProjects.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    // Aggregate Analytics
    const totalProjects = projects.length;
    const avgHealthScore = totalProjects > 0 
        ? Math.round(projects.reduce((acc, p) => acc + (p.healthScore || 0), 0) / totalProjects)
        : 0;
    const favoriteCount = projects.filter(p => p.isFavorite).length;



    return (
        <div className="flex flex-col gap-8 w-full">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <PageHeader>
                    <ZoruPageHeading>
                        <ZoruPageTitle>SEO Projects</ZoruPageTitle>
                        <ZoruPageDescription>
                            Manage your website rankings, audits, and competitors.
                        </ZoruPageDescription>
                    </ZoruPageHeading>
                </PageHeader>
                <CreateSeoProjectDialog />
            </div>

            {totalProjects > 0 && (
                <div className="grid gap-4 md:grid-cols-3 mb-2">
                    <Card className="p-4 flex items-center gap-4 border-zoru-line/50 bg-zoru-surface/50 backdrop-blur-sm">
                        <div className="h-10 w-10 rounded-full bg-zoru-ink/10 flex items-center justify-center">
                            <BarChart className="h-5 w-5 text-zoru-ink" />
                        </div>
                        <div>
                            <p className="text-sm text-zoru-ink-muted">Total Projects</p>
                            <p className="text-2xl font-bold">{totalProjects}</p>
                        </div>
                    </Card>
                    <Card className="p-4 flex items-center gap-4 border-zoru-line/50 bg-zoru-surface/50 backdrop-blur-sm">
                        <div className="h-10 w-10 rounded-full bg-zoru-ink/10 flex items-center justify-center">
                            <Activity className="h-5 w-5 text-zoru-ink" />
                        </div>
                        <div>
                            <p className="text-sm text-zoru-ink-muted">Avg Health Score</p>
                            <p className="text-2xl font-bold">{avgHealthScore}</p>
                        </div>
                    </Card>
                    <Card className="p-4 flex items-center gap-4 border-zoru-line/50 bg-zoru-surface/50 backdrop-blur-sm">
                        <div className="h-10 w-10 rounded-full bg-zoru-ink/10 flex items-center justify-center">
                            <Star className="h-5 w-5 text-zoru-ink" />
                        </div>
                        <div>
                            <p className="text-sm text-zoru-ink-muted">Starred Projects</p>
                            <p className="text-2xl font-bold">{favoriteCount}</p>
                        </div>
                    </Card>
                </div>
            )}

            {totalProjects > 0 && (
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-zoru-surface-2/20 p-2 rounded-lg border border-zoru-line/50">
                    <div className="relative w-full sm:w-96">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zoru-ink-muted" />
                        <Input
                            placeholder="Search by domain..."
                            className="pl-9 bg-zoru-surface"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="w-full sm:w-48">
                        <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger className="bg-zoru-surface">
                                <SelectValue placeholder="Sort by" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="newest">Newest First</SelectItem>
                                <SelectItem value="oldest">Oldest First</SelectItem>
                                <SelectItem value="health">Health Score</SelectItem>
                                <SelectItem value="name">Domain Name</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            )}

            {totalProjects === 0 ? (
                <Card className="border-dashed p-12">
                    <div className="flex flex-col items-center justify-center text-center">
                        <div className="h-16 w-16 bg-zoru-surface-2 rounded-full flex items-center justify-center mb-4">
                            <BarChart className="h-8 w-8 text-zoru-ink-muted" />
                        </div>
                        <h3 className="text-lg mb-2">No projects yet</h3>
                        <p className="text-zoru-ink-muted mb-6 max-w-md">
                            Start tracking your website&apos;s SEO performance by creating your first project.
                        </p>
                        <CreateSeoProjectDialog />
                    </div>
                </Card>
            ) : filteredAndSortedProjects.length === 0 ? (
                <Card className="border-dashed p-12">
                    <div className="flex flex-col items-center justify-center text-center">
                        <Search className="h-12 w-12 text-zoru-ink-muted mb-4" />
                        <h3 className="text-lg mb-2">No results found</h3>
                        <p className="text-zoru-ink-muted mb-6">
                            No projects match your search query &quot;{searchQuery}&quot;.
                        </p>
                        <Button variant="outline" onClick={() => setSearchQuery('')}>
                            Clear Search
                        </Button>
                    </div>
                </Card>
            ) : (
                <>
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {paginatedProjects.map((project: any) => (
                            <SeoProjectCard
                                key={project._id}
                                project={project}
                                onToggleFavorite={handleToggleFavorite}
                                onDelete={handleDelete}
                            />
                        ))}
                    </div>
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 mt-6">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                            >
                                <ChevronLeft className="h-4 w-4 mr-1" />
                                Previous
                            </Button>
                            <span className="text-sm text-zoru-ink-muted px-4">
                                Page {page} of {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                            >
                                Next
                                <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
