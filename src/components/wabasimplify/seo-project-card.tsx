'use client';

import { useRouter } from 'next/navigation';
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart, ExternalLink, ArrowRight, Trash2, MoreVertical, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Define a flexible interface that can handle SEO Project data
// We can import the exact type, but for UI component flexibility we can define shape
interface SeoProjectData {
    _id: string | any;
    domain?: string;
    name?: string;
    healthScore?: number;
    lastAuditDate?: Date | string;
    competitors?: string[];
    createdAt?: Date | string;
}

interface SeoProjectCardProps {
    project: SeoProjectData;
}

export const SeoProjectCard = React.memo(function SeoProjectCard({ project }: SeoProjectCardProps) {
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
                "border-border/50 bg-background/50 backdrop-blur-sm",
                "hover:shadow-xl hover:-translate-y-1 hover:border-orange-500/50", // Orange for SEO
                "cursor-pointer overflow-hidden rounded-xl"
            )}
            onClick={handleCardClick}
        >
            {/* Gradient Accent Line */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-amber-600" />

            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-5">
                <div className="flex-1 min-w-0 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center flex-shrink-0">
                        <BarChart className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                        <CardTitle className="font-bold text-lg truncate group-hover:text-primary transition-colors">
                            {displayName}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">
                            SEO Monitoring
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1 -mr-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-full">
                                <MoreVertical className="h-4 w-4" />
                                <span className="sr-only">Open menu</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem className="text-destructive focus:text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" /> Delete Project
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </CardHeader>

            <CardContent className="space-y-4 pb-4">
                <div className="grid grid-cols-2 gap-4 my-2">
                    <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-muted/30 border border-border/20">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Health Score</span>
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                <div
                                    className={cn(
                                        "h-full transition-all duration-500",
                                        healthScore >= 90 ? 'bg-green-500' : healthScore >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                                    )}
                                    style={{ width: `${healthScore}%` }}
                                />
                            </div>
                            <span className="font-bold text-sm">{healthScore}</span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-muted/30 border border-border/20">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Last Audit</span>
                        <div className="flex items-center gap-1.5 text-sm font-medium">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="truncate">{lastAuditText}</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Competitors</span>
                    <div className="flex flex-wrap gap-2 min-h-[1.5rem]">
                        {project.competitors && project.competitors.length > 0 ? (
                            project.competitors.slice(0, 3).map((comp: string) => (
                                <Badge key={comp} variant="outline" className="text-[10px] font-normal px-1.5 h-5 bg-background/50">
                                    {comp}
                                </Badge>
                            ))
                        ) : (
                            <span className="text-xs text-muted-foreground italic">None added</span>
                        )}
                    </div>
                </div>

                <div className="pt-2">
                    <Button
                        className="w-full bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white shadow-md shadow-orange-500/10 border-0"
                        size="sm"
                    >
                        View Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
});
