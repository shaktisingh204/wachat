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

import { SeoProjectCard } from '@/components/wabasimplify/seo-project-card';
import { BarChart, Search, Activity, Star } from 'lucide-react';
import { getSeoProjects } from '@/app/actions/seo.actions';
import { CreateSeoProjectDialog } from '@/components/wabasimplify/seo/create-project-dialog';
import type { SeoProject } from '@/lib/seo/definitions';

export default function SeoProjectsPage() {
    const [projects, setProjects] = useState<SeoProject[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('newest');
    const { toast } = useZoruToast();

    useEffect(() => {
        getSeoProjects()
            .then(data => {
                setProjects(data);
                setLoading(false);
            })
            .catch(error => {
                console.error("Failed to fetch SEO projects:", error);
                toast({
                    title: "Error fetching projects",
                    description: error?.message || "An unexpected error occurred.",
                    variant: "destructive"
                });
                setLoading(false);
            });
    }, [toast]);

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

    // Aggregate Analytics
    const totalProjects = projects.length;
    const avgHealthScore = totalProjects > 0 
        ? Math.round(projects.reduce((acc, p) => acc + (p.healthScore || 0), 0) / totalProjects)
        : 0;
    const favoriteCount = projects.filter(p => p.isFavorite).length;

    if (loading) return <Skeleton className="h-[400px] w-full" />;

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
                    <Card className="p-4 flex items-center gap-4 border-border/50 bg-background/50 backdrop-blur-sm">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <BarChart className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Projects</p>
                            <p className="text-2xl font-bold">{totalProjects}</p>
                        </div>
                    </Card>
                    <Card className="p-4 flex items-center gap-4 border-border/50 bg-background/50 backdrop-blur-sm">
                        <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                            <Activity className="h-5 w-5 text-green-500" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Avg Health Score</p>
                            <p className="text-2xl font-bold">{avgHealthScore}</p>
                        </div>
                    </Card>
                    <Card className="p-4 flex items-center gap-4 border-border/50 bg-background/50 backdrop-blur-sm">
                        <div className="h-10 w-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                            <Star className="h-5 w-5 text-yellow-500" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Starred Projects</p>
                            <p className="text-2xl font-bold">{favoriteCount}</p>
                        </div>
                    </Card>
                </div>
            )}

            {totalProjects > 0 && (
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-muted/20 p-2 rounded-lg border border-border/50">
                    <div className="relative w-full sm:w-96">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by domain..."
                            className="pl-9 bg-background"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="w-full sm:w-48">
                        <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger className="bg-background">
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
                        <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
                            <BarChart className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg mb-2">No projects yet</h3>
                        <p className="text-muted-foreground mb-6 max-w-md">
                            Start tracking your website&apos;s SEO performance by creating your first project.
                        </p>
                        <CreateSeoProjectDialog />
                    </div>
                </Card>
            ) : filteredAndSortedProjects.length === 0 ? (
                <Card className="border-dashed p-12">
                    <div className="flex flex-col items-center justify-center text-center">
                        <Search className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg mb-2">No results found</h3>
                        <p className="text-muted-foreground mb-6">
                            No projects match your search query &quot;{searchQuery}&quot;.
                        </p>
                        <Button variant="outline" onClick={() => setSearchQuery('')}>
                            Clear Search
                        </Button>
                    </div>
                </Card>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {filteredAndSortedProjects.map((project: any) => (
                        <SeoProjectCard key={project._id} project={project} />
                    ))}
                </div>
            )}
        </div>
    );
}
