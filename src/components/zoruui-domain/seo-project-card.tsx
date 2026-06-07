'use client';

import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Button,
  IconButton,
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  useToast,
} from '@/components/sabcrm/20ui';
import { useRouter } from 'next/navigation';
import React from 'react';
import { BarChart, ArrowRight, Trash2, MoreVertical, Calendar, Star } from 'lucide-react';
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
    const { toast } = useToast();

    // Handle differences between main Project type and SeoProject type
    const displayName = project.domain || project.name || 'Untitled Project';
    const healthScore = project.healthScore || 0;
    const lastAuditText = project.lastAuditDate
        ? formatDistanceToNow(new Date(project.lastAuditDate), { addSuffix: true })
        : 'Never';
    const healthBarClass =
        healthScore >= 90
            ? 'bg-[var(--st-status-ok)]'
            : healthScore >= 70
              ? 'bg-[var(--st-warn)]'
              : 'bg-[var(--st-danger)]';

    const handleCardClick = (e: React.MouseEvent) => {
        // Prevent navigation if clicking on interactive elements
        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('[role="menuitem"]') || (e.target as HTMLElement).closest('a')) {
            return;
        }
        router.push(`/dashboard/seo/${project._id}`);
    };

    const handleToggleFavorite = async () => {
        if (onToggleFavorite) {
            onToggleFavorite(String(project._id), !!project.isFavorite);
            return;
        }
        try {
            const { toggleSeoProjectFavorite } = await import('@/app/actions/seo.actions');
            await toggleSeoProjectFavorite(String(project._id), !project.isFavorite);
            window.location.reload(); // Fallback if no callback provided
        } catch (err) {
            console.error(err);
            toast.error('Could not update favorite. Please try again.');
        }
    };

    const handleDelete = async () => {
        if (!window.confirm(`Delete "${displayName}"? This cannot be undone.`)) return;

        if (onDelete) {
            onDelete(String(project._id));
            return;
        }
        const res = await deleteSeoProject(String(project._id));
        if (res?.error) {
            toast.error(res.error);
        } else {
            window.location.reload();
        }
    };

    return (
        <Card
            variant="interactive"
            padding="none"
            className={cn(
                "group relative flex flex-col overflow-hidden",
                "cursor-pointer rounded-[var(--st-radius)]"
            )}
            onClick={handleCardClick}
        >
            {/* Accent line */}
            <div className="absolute top-0 left-0 w-full h-1 bg-[var(--st-accent)]" aria-hidden="true" />

            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-5">
                <div className="flex-1 min-w-0 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-[var(--st-bg-muted)] flex items-center justify-center flex-shrink-0">
                        <BarChart className="h-5 w-5 text-[var(--st-accent)]" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                        <CardTitle className="font-bold text-lg truncate">
                            {displayName}
                        </CardTitle>
                        <p className="text-xs text-[var(--st-text-secondary)] font-mono mt-0.5">
                            SEO Monitoring
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1 -mr-2">
                    <IconButton
                        label={project.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                        icon={Star}
                        variant="ghost"
                        size="sm"
                        className={project.isFavorite ? 'text-[var(--st-warn)]' : 'text-[var(--st-text-secondary)]'}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void handleToggleFavorite();
                        }}
                    />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <IconButton
                                label="Open project menu"
                                icon={MoreVertical}
                                variant="ghost"
                                size="sm"
                                className="text-[var(--st-text-secondary)]"
                            />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem
                                variant="danger"
                                iconLeft={Trash2}
                                onSelect={(e) => {
                                    e.preventDefault();
                                    void handleDelete();
                                }}
                            >
                                Delete Project
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </CardHeader>

            <CardBody className="space-y-4 pb-4">
                <div className="grid grid-cols-2 gap-4 my-2">
                    <div className="flex flex-col gap-1.5 p-2 rounded-[var(--st-radius)] bg-[var(--st-bg-muted)]/30 border border-[var(--st-border)]">
                        <span className="text-[10px] uppercase tracking-wider text-[var(--st-text-secondary)] font-bold">Health Score</span>
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-full bg-[var(--st-bg-muted)] rounded-full overflow-hidden">
                                <div
                                    className={cn("h-full transition-all duration-500", healthBarClass)}
                                    style={{ width: `${healthScore}%` }}
                                />
                            </div>
                            <span className="font-bold text-sm text-[var(--st-text)]">{healthScore}</span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5 p-2 rounded-[var(--st-radius)] bg-[var(--st-bg-muted)]/30 border border-[var(--st-border)]">
                        <span className="text-[10px] uppercase tracking-wider text-[var(--st-text-secondary)] font-bold">Last Audit</span>
                        <div className="flex items-center gap-1.5 text-sm font-medium text-[var(--st-text)]">
                            <Calendar className="h-3.5 w-3.5 text-[var(--st-text-secondary)]" aria-hidden="true" />
                            <span className="truncate">{lastAuditText}</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-[var(--st-text-secondary)] font-bold">Competitors</span>
                    <div className="flex flex-wrap gap-2 min-h-[1.5rem]">
                        {project.competitors && project.competitors.length > 0 ? (
                            project.competitors.slice(0, 3).map((comp: string) => (
                                <Badge key={comp} variant="outline" className="text-[10px] font-normal">
                                    {comp}
                                </Badge>
                            ))
                        ) : (
                            <span className="text-xs text-[var(--st-text-secondary)] italic">None added</span>
                        )}
                    </div>
                </div>

                <div className="pt-2">
                    <Link href={`/dashboard/seo/${project._id}`} className="block">
                        <Button
                            variant="gradient"
                            size="sm"
                            block
                            iconRight={ArrowRight}
                        >
                            View Dashboard
                        </Button>
                    </Link>
                </div>
            </CardBody>
        </Card>
    );
});
