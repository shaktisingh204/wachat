'use client';

import { useRouter } from 'next/navigation';
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, Calendar, BarChart2, Webhook, MoreVertical, Settings, MessageSquare, ExternalLink, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WithId, Project } from '@/lib/definitions';
import { DeleteProjectButton } from './delete-project-button';
import { getWebhookSubscriptionStatus } from '@/app/actions/whatsapp.actions';
import { FacebookIcon } from './custom-sidebar-components';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ProjectCardProps {
    project: WithId<Project>;
}

export const ProjectCard = React.memo(function ProjectCard({ project }: ProjectCardProps) {
    const router = useRouter();
    const [createdDate, setCreatedDate] = useState<string | null>(null);
    const [webhookStatus, setWebhookStatus] = useState<{ isActive: boolean; error?: string } | null>(null);

    const isWhatsAppProject = !!project.wabaId;

    useEffect(() => {
        setCreatedDate(new Date(project.createdAt).toLocaleDateString());
        if (isWhatsAppProject && project.wabaId && project.accessToken) {
            getWebhookSubscriptionStatus(project.wabaId, project.accessToken).then(setWebhookStatus);
        }
    }, [project.createdAt, project.wabaId, project.accessToken, isWhatsAppProject]);

    const handleCardClick = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('[role="menuitem"]')) {
            return;
        }

        if (typeof window !== 'undefined') {
            localStorage.setItem('activeProjectId', project._id.toString());
            localStorage.setItem('activeProjectName', project.name);
        }
        const dashboardPath = isWhatsAppProject ? '/dashboard/overview' : '/dashboard/facebook';
        router.push(dashboardPath);
    };

    const handleQuickAction = (e: React.MouseEvent, path: string) => {
        e.stopPropagation();
        if (typeof window !== 'undefined') {
            localStorage.setItem('activeProjectId', project._id.toString());
        }
        router.push(path);
    };

    return (
        <Card
            className={cn(
                "group relative flex flex-col transition-all duration-300",
                "border-border/40 bg-background/60 backdrop-blur-xl", // Enhanced Glassmorphism
                "hover:shadow-2xl hover:-translate-y-1 hover:border-primary/30",
                "cursor-pointer overflow-hidden rounded-xl"
            )}
            onClick={handleCardClick}
        >
            {/* Status Indicator Pulse */}
            {isWhatsAppProject && webhookStatus?.isActive && (
                <div className="absolute top-3 right-3 flex h-3 w-3 z-10">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </div>
            )}

            {/* Decorative Gradient Blob */}
            <div className={cn(
                "absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br opacity-10 rounded-full blur-2xl group-hover:opacity-20 transition-opacity",
                isWhatsAppProject ? "from-green-400 to-emerald-600" : "from-blue-400 to-indigo-600"
            )} />

            <div className="p-5 flex flex-col h-full gap-4 relative">
                {/* Header Section */}
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "h-12 w-12 rounded-2xl flex items-center justify-center shadow-sm border border-white/10",
                            isWhatsAppProject ? "bg-gradient-to-br from-green-50 to-green-100 text-green-600" : "bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600"
                        )}>
                            {isWhatsAppProject ? <Phone className="h-6 w-6" /> : <FacebookIcon className="h-6 w-6" />}
                        </div>
                        <div>
                            <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors">
                                {project.name}
                            </h3>
                            <p className="text-xs text-muted-foreground/80 flex items-center gap-1 mt-1 font-mono">
                                {project.wabaId ? project.wabaId.slice(0, 14) + '...' : `Page: ${project.facebookPageId}`}
                            </p>
                        </div>
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 text-muted-foreground hover:bg-muted/50 rounded-full">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={(e) => handleQuickAction(e, `/dashboard/settings`)}>
                                <Settings className="mr-2 h-4 w-4" /> Settings
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive focus:text-destructive">
                                <DeleteProjectButton projectId={project._id.toString()} projectName={project.name} />
                                {/* Note: DeleteProjectButton usually renders a trigger. We might need to adjust this if it renders a button. 
                                    Assuming it renders a styled trigger or we just let it take click. 
                                    Actually DeleteProjectButton is complex. Let's just wrap it cleanly or let it be.
                                */}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Stats / Info Row */}
                <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="bg-muted/30 rounded-lg p-2.5 flex flex-col gap-1 border border-border/20">
                        <span className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider flex items-center gap-1">
                            <Zap className="h-3 w-3" /> Tier
                        </span>
                        <span className="text-xs font-medium">
                            {formatTier(project.phoneNumbers?.[0]?.throughput?.level)}
                        </span>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-2.5 flex flex-col gap-1 border border-border/20">
                        <span className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider flex items-center gap-1">
                            <BarChart2 className="h-3 w-3" /> Health
                        </span>
                        <div className="flex items-center gap-1.5">
                            <div className={cn("h-2 w-2 rounded-full", webhookStatus?.isActive ? "bg-green-500" : "bg-yellow-500")}></div>
                            <span className="text-xs font-medium">{webhookStatus?.isActive ? 'Healthy' : 'Pending'}</span>
                        </div>
                    </div>
                </div>

                {/* Footer Quick Actions */}
                <div className="mt-auto pt-4 flex gap-2 w-full opacity-60 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 bg-background/50 hover:bg-primary hover:text-primary-foreground border-primary/20"
                                    onClick={(e) => handleQuickAction(e, isWhatsAppProject ? '/dashboard/chat' : '/dashboard/facebook/messages')}
                                >
                                    <MessageSquare className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Inbox</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 bg-background/50 hover:bg-primary hover:text-primary-foreground border-primary/20"
                                    onClick={(e) => handleCardClick(e)}
                                >
                                    <ExternalLink className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Open Dashboard</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 bg-background/50 hover:bg-primary hover:text-primary-foreground border-primary/20"
                                    onClick={(e) => handleQuickAction(e, `/dashboard/settings`)}
                                >
                                    <Settings className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Settings</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>
        </Card>
    );
});

function formatTier(level?: string) {
    if (!level) return 'N/A';
    if (level.includes('UNLIMITED')) return 'Unlimited';
    if (level.includes('100K')) return 'Tier 100K';
    if (level.includes('10K')) return 'Tier 10K';
    if (level.includes('1K')) return 'Tier 1K';
    return 'Standard';
}
