'use client';

import { useRouter } from 'next/navigation';
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, Calendar, BarChart2, Webhook, MoreVertical, Trash2 } from 'lucide-react';
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
        // Prevent navigation if clicking on interactive elements
        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('[role="menuitem"]')) {
            return;
        }

        if (typeof window !== 'undefined') {
            localStorage.setItem('activeProjectId', project._id.toString());
            localStorage.setItem('activeProjectName', project.name);
        }
        // Redirect based on project type
        const dashboardPath = isWhatsAppProject ? '/dashboard/overview' : '/dashboard/facebook/all-projects';
        router.push(dashboardPath);
    };

    const getReviewStatusVariant = (status?: string) => {
        if (!status) return 'outline';
        const lowerStatus = status.toLowerCase();
        if (lowerStatus === 'approved' || lowerStatus === 'verified') return 'default';
        if (lowerStatus.includes('pending') || lowerStatus.includes('unknown')) return 'secondary';
        return 'destructive';
    };

    const formatThroughput = (level?: string): string => {
        if (!level) return 'N/A';
        const lowerLevel = level.toLowerCase();

        if (lowerLevel.includes('unlimited')) {
            return 'Unlimited';
        }
        if (lowerLevel.startsWith('tier_')) {
            const tierValue = lowerLevel.replace('tier_', '').toUpperCase();
            return `${tierValue}`;
        }

        return level.replace(/_/g, ' ').toLowerCase();
    };

    const getThroughputVariant = (level?: string) => {
        if (!level) return 'outline';
        const lowerLevel = level.toLowerCase();

        if (lowerLevel.includes('unlimited') || lowerLevel.includes('100k') || lowerLevel.includes('high')) {
            return 'default'; // Green
        }
        if (lowerLevel.includes('10k') || lowerLevel.includes('medium')) {
            return 'secondary'; // Yellow-ish/Grey
        }
        if (lowerLevel.includes('1k') || lowerLevel.includes('low')) {
            return 'destructive'; // Red
        }

        return 'outline'; // Default for unknown tiers
    };

    const throughputLevel = project.phoneNumbers?.[0]?.throughput?.level;

    return (
        <Card
            className={cn(
                "group relative flex flex-col transition-all duration-300",
                "border-border/50 bg-background/50 backdrop-blur-sm",
                "hover:shadow-xl hover:-translate-y-1 hover:border-primary/50",
                "cursor-pointer overflow-hidden"
            )}
            onClick={handleCardClick}
        >
            {/* Gradient Accent Line */}
            <div className={cn(
                "absolute top-0 left-0 w-full h-1 bg-gradient-to-r",
                isWhatsAppProject ? "from-green-500 to-emerald-600" : "from-blue-500 to-indigo-600"
            )} />

            <CardHeader className="pb-2 pt-5">
                <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            {isWhatsAppProject ? (
                                <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                                    <Phone className="h-3 w-3 text-green-700" />
                                </div>
                            ) : (
                                <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                    <FacebookIcon className="h-3 w-3 text-blue-700" />
                                </div>
                            )}
                            <h3 className="text-lg font-bold truncate leading-tight group-hover:text-primary transition-colors">
                                {project.name}
                            </h3>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground ml-8">
                            <div className="font-mono opacity-70">
                                {project.wabaId ? `WABA: ${project.wabaId.slice(0, 10)}...` : `Page: ${project.facebookPageId}`}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 -mr-2">
                        {/* Status Badges */}
                        {project.banState === 'RESTRICTED' && (
                            <Badge variant="destructive" className="capitalize text-[10px] h-5 px-1.5 flex-shrink-0">
                                Disabled
                            </Badge>
                        )}
                        {project.reviewStatus && project.reviewStatus !== 'UNKNOWN' && (
                            <Badge variant={getReviewStatusVariant(project.reviewStatus)} className="capitalize text-[10px] h-5 px-1.5 flex-shrink-0">
                                {project.reviewStatus.replace(/_/g, ' ').toLowerCase()}
                            </Badge>
                        )}

                        {/* Actions Menu */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                    <MoreVertical className="h-4 w-4" />
                                    <span className="sr-only">Open menu</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {/* We wrap the delete button logic here or just render the component slightly differently if it accepts custom trigger */}
                                {/* For now, keeping the DeleteProjectButton but we might need to adjust it to fit in a menu item, 
                                    OR we just put the delete button triggering logic here. 
                                    Looking at DeleteProjectButton, it renders a dialog trigger. 
                                    To keep it simple and working: we can put the DeleteProjectButton directly in the header if we want, 
                                    OR we can try to compose it. 
                                    
                                    Let's keep it simple: Reset the DeleteProjectButton to be a menu item trigger if possible, 
                                    BUT DeleteProjectButton likely renders a default Button trigger.
                                    
                                    New Plan for Actions: Just show the DeleteProjectButton as a discrete action 
                                    OR keep it simple and just show the menu if we had more actions. 
                                    Since we only have Delete, let's just show a trash icon button that triggers the dialog.
                                    
                                    Wait, DeleteProjectButton encapsulates the Dialog logic.
                                    Let's just position the DeleteProjectButton nicely.
                                */}
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
                            <BarChart2 className="h-3 w-3" /> Msg Tier
                        </span>
                        <span>
                            {throughputLevel ? (
                                <Badge variant={getThroughputVariant(throughputLevel)} className="h-5 px-1.5 text-[10px]">
                                    {formatThroughput(throughputLevel)}
                                </Badge>
                            ) : (<span className="text-muted-foreground">-</span>)}
                        </span>
                    </div>

                    {isWhatsAppProject && (
                        <>
                            <div className="flex flex-col gap-1 p-2 rounded-md bg-muted/40 group-hover:bg-muted/60 transition-colors">
                                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                                    <Phone className="h-3 w-3" /> Numbers
                                </span>
                                <span className="font-medium">{project.phoneNumbers?.length || 0}</span>
                            </div>

                            <div className="flex flex-col gap-1 p-2 rounded-md bg-muted/40 group-hover:bg-muted/60 transition-colors">
                                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                                    <Webhook className="h-3 w-3" /> Webhook
                                </span>
                                <div>
                                    {webhookStatus ? (
                                        <div className={cn(
                                            "inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium border",
                                            webhookStatus.isActive
                                                ? "bg-green-500/10 text-green-700 border-green-200 dark:border-green-900"
                                                : "bg-red-500/10 text-red-700 border-red-200 dark:border-red-900"
                                        )}>
                                            <span className={cn("h-1.5 w-1.5 rounded-full", webhookStatus.isActive ? "bg-green-500" : "bg-red-500")} />
                                            {webhookStatus.isActive ? 'Active' : 'Inactive'}
                                        </div>
                                    ) : (
                                        <span className="text-[10px] text-muted-foreground">Checking...</span>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </CardContent>
        </Card>
    );
});
