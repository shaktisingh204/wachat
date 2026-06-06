'use client';

import {
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  Button,
  Badge,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
} from '@/components/sabcrm/20ui/compat';
import {
  useRouter } from 'next/navigation';
import React from 'react';
import { BarChart, ArrowRight, Trash2, MoreVertical, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

import { deleteSeoProject } from '@/app/actions/seo.actions';

// Define a flexible interface that can handle SEO Project data
// We can import the exact type, but for UI component flexibility we can define shape
interface SeoProjectData {
    _id: string | any;
    domain?: string;
    name?: string;
    healthScore?: number;
    lastAuditDate?: Date | string;
    competitors?: string[];
    isFavorite?: boolean;
    createdAt?: Date | string;
}

interface SeoProjectCardProps {
    project: SeoProjectData;
    onToggleFavorite?: (id: string, isFavorite: boolean) => void;
    onDelete?: (id: string) => void;
}

export const SeoProjectCard = React.memo(function SeoProjectCard({ project, onToggleFavorite, onDelete }: SeoProjectCardProps) {
    const router = useRouter();

    // Handle differences between main Project type and SeoProject type
    const displayName = project.domain || project.name || 'Untitled Project';
    const healthScore = project.healthScore || 0;
    const lastAuditText = project.lastAuditDate
        ? formatDistanceToNow(new Date(project.lastAuditDate), { addSuffix: true })
        : 'Never';

    const handleCardClick = (e: React.MouseEvent) => {
        // Prevent navigation if clicking on interactive elements
        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('[role="menuitem"]') || (e.target as HTMLElement).closest('a')) {
            return;
        }
        router.push(`/dashboard/seo/${project._id}`);
    };

    return (
        <Card
            className={cn(
                "group relative flex flex-col transition-all duration-300",
                "border-zoru-line/50 bg-zoru-surface/50 backdrop-blur-sm",
                "hover:shadow-xl hover:-translate-y-1 hover:border-zoru-line/50", // Orange for SEO
                "cursor-pointer overflow-hidden rounded-xl"
            )}
            onClick={handleCardClick}
        >
            {/* Gradient Accent Line */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-zoru-ink to-zoru-ink" />

            <ZoruCardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-5">
                <div className="flex-1 min-w-0 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-zoru-surface-2 dark:bg-zoru-ink/20 flex items-center justify-center flex-shrink-0">
                        <BarChart className="h-5 w-5 text-zoru-ink dark:text-zoru-ink-muted" />
                    </div>
                    <div>
                        <ZoruCardTitle className="font-bold text-lg truncate group-hover:text-zoru-ink transition-colors">
                            {displayName}
                        </ZoruCardTitle>
                        <p className="text-xs text-zoru-ink-muted font-mono mt-0.5">
                            SEO Monitoring
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1 -mr-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn("h-8 w-8 rounded-full", project.isFavorite ? "text-zoru-ink hover:text-zoru-ink" : "text-zoru-ink-muted hover:text-zoru-ink")}
                        onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (onToggleFavorite) {
                                onToggleFavorite(String(project._id), !!project.isFavorite);
                            } else {
                                try {
                                    const { toggleSeoProjectFavorite } = await import('@/app/actions/seo.actions');
                                    await toggleSeoProjectFavorite(String(project._id), !project.isFavorite);
                                    window.location.reload(); // Fallback if no callback provided
                                } catch (e) {
                                    console.error(e);
                                }
                            }
                        }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill={project.isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                        <span className="sr-only">Toggle Favorite</span>
                    </Button>
                    <DropdownMenu>
                        <ZoruDropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-zoru-ink-muted hover:text-zoru-ink rounded-full">
                                <MoreVertical className="h-4 w-4" />
                                <span className="sr-only">Open menu</span>
                            </Button>
                        </ZoruDropdownMenuTrigger>
                        <ZoruDropdownMenuContent align="end">
                            <ZoruDropdownMenuItem
                                className="text-zoru-ink focus:text-zoru-ink"
                                onSelect={async (e) => {
                                    e.preventDefault();
                                    if (!window.confirm(`Delete "${displayName}"? This cannot be undone.`)) return;
                                    
                                    if (onDelete) {
                                        onDelete(String(project._id));
                                    } else {
                                        const res = await deleteSeoProject(String(project._id));
                                        if (res?.error) {
                                            window.alert(res.error);
                                        } else {
                                            window.location.reload();
                                        }
                                    }
                                }}
                            >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete Project
                            </ZoruDropdownMenuItem>
                        </ZoruDropdownMenuContent>
                    </DropdownMenu>
                </div>
            </ZoruCardHeader>

            <ZoruCardContent className="space-y-4 pb-4">
                <div className="grid grid-cols-2 gap-4 my-2">
                    <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-zoru-surface-2/30 border border-zoru-line/20">
                        <span className="text-[10px] uppercase tracking-wider text-zoru-ink-muted font-bold">Health Score</span>
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-full bg-zoru-surface-2 rounded-full overflow-hidden">
                                <div
                                    className={cn(
                                        "h-full transition-all duration-500",
                                        healthScore >= 90 ? 'bg-zoru-ink' : healthScore >= 70 ? 'bg-zoru-ink' : 'bg-zoru-ink'
                                    )}
                                    style={{ width: `${healthScore}%` }}
                                />
                            </div>
                            <span className="font-bold text-sm">{healthScore}</span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-zoru-surface-2/30 border border-zoru-line/20">
                        <span className="text-[10px] uppercase tracking-wider text-zoru-ink-muted font-bold">Last Audit</span>
                        <div className="flex items-center gap-1.5 text-sm font-medium">
                            <Calendar className="h-3.5 w-3.5 text-zoru-ink-muted" />
                            <span className="truncate">{lastAuditText}</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-zoru-ink-muted font-bold">Competitors</span>
                    <div className="flex flex-wrap gap-2 min-h-[1.5rem]">
                        {project.competitors && project.competitors.length > 0 ? (
                            project.competitors.slice(0, 3).map((comp: string) => (
                                <Badge key={comp} variant="outline" className="text-[10px] font-normal px-1.5 h-5 bg-zoru-surface/50">
                                    {comp}
                                </Badge>
                            ))
                        ) : (
                            <span className="text-xs text-zoru-ink-muted italic">None added</span>
                        )}
                    </div>
                </div>

                <div className="pt-2">
                    <Link href={`/dashboard/seo/${project._id}`} className="block">
                        <Button
                            className="w-full bg-gradient-to-r from-zoru-ink to-zoru-ink hover:from-zoru-ink hover:to-zoru-ink text-white shadow-md shadow-zoru-line/10 border-0"
                            size="sm"
                        >
                            View Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </Link>
                </div>
            </ZoruCardContent>
        </Card>
    );
});
