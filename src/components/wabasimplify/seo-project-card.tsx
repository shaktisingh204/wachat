'use client';

import { useRouter } from 'next/navigation';
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, BarChart2, MoreVertical, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WithId, Project } from '@/lib/definitions';
import { DeleteProjectButton } from './delete-project-button';
import { SeoIcon } from './custom-sidebar-components'; // Using SeoIcon if available, or fallback
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SeoProjectCardProps {
    project: WithId<Project>;
}

export const SeoProjectCard = React.memo(function SeoProjectCard({ project }: SeoProjectCardProps) {
    const router = useRouter();
    const [createdDate, setCreatedDate] = useState<string | null>(null);

    useEffect(() => {
        setCreatedDate(new Date(project.createdAt).toLocaleDateString());
    }, [project.createdAt]);

    const handleCardClick = (e: React.MouseEvent) => {
        // Prevent navigation if clicking on interactive elements
        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('[role="menuitem"]')) {
            return;
        }

        if (typeof window !== 'undefined') {
            localStorage.setItem('activeProjectId', project._id.toString());
            localStorage.setItem('activeProjectName', project.name);
        }
        // Redirect to SEO dashboard or default
        router.push('/dashboard/seo');
    };

    return (
        <Card
            className={cn(
                "group relative flex flex-col transition-all duration-300",
                "border-border/50 bg-background/50 backdrop-blur-sm",
                "hover:shadow-xl hover:-translate-y-1 hover:border-orange-500/50", // Orange for SEO
                "cursor-pointer overflow-hidden"
            )}
            onClick={handleCardClick}
        >
            {/* Gradient Accent Line */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-amber-600" />

            <CardHeader className="pb-2 pt-5">
                <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="h-6 w-6 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                                <SeoIcon className="h-3 w-3 text-orange-700" />
                            </div>
                            <h3 className="text-lg font-bold truncate leading-tight group-hover:text-primary transition-colors">
                                {project.name}
                            </h3>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground ml-8">
                            <div className="font-mono opacity-70">
                                SEO Project
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 -mr-2">
                        {/* Actions Menu */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                    <MoreVertical className="h-4 w-4" />
                                    <span className="sr-only">Open menu</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {/* Actions placeholder */}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <div className="flex items-center">
                            <DeleteProjectButton projectId={project._id.toString()} projectName={project.name} />
                        </div>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-4 pb-4">
                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex flex-col gap-1 p-2 rounded-md bg-muted/40 group-hover:bg-muted/60 transition-colors">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                            <Calendar className="h-3 w-3" /> Created
                        </span>
                        <span className="font-medium truncate">{createdDate || 'Loading...'}</span>
                    </div>

                    <div className="flex flex-col gap-1 p-2 rounded-md bg-muted/40 group-hover:bg-muted/60 transition-colors">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                            <BarChart2 className="h-3 w-3" /> Status
                        </span>
                        <span>
                            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                                Active
                            </Badge>
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
});
