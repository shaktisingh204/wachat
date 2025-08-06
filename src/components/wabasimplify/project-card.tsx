
'use client';

import { useRouter } from 'next/navigation';
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, Calendar, BarChart2, Briefcase, Webhook } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WithId, Project } from '@/lib/definitions';
import { DeleteProjectButton } from './delete-project-button';
import { getWebhookSubscriptionStatus } from '@/app/actions/whatsapp.actions';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle, AlertCircle } from 'lucide-react';


interface ProjectCardProps {
    project: WithId<Project>;
    selectionMode?: boolean;
    isSelected?: boolean;
    onSelect?: (projectId: string) => void;
}

export const ProjectCard = React.memo(function ProjectCard({ project, selectionMode = false, isSelected, onSelect }: ProjectCardProps) {
    const router = useRouter();
    const [createdDate, setCreatedDate] = useState<string | null>(null);
    const [webhookStatus, setWebhookStatus] = useState<{ isActive: boolean; error?: string } | null>(null);

    useEffect(() => {
        setCreatedDate(new Date(project.createdAt).toLocaleDateString());
        if (project.wabaId && project.accessToken) {
            getWebhookSubscriptionStatus(project.wabaId, project.accessToken).then(setWebhookStatus);
        }
    }, [project.createdAt, project.wabaId, project.accessToken]);

    const handleCardClick = () => {
        if (selectionMode && onSelect) {
            onSelect(project._id.toString());
        } else if (!selectionMode) {
            if (typeof window !== 'undefined') {
                localStorage.setItem('activeProjectId', project._id.toString());
                localStorage.setItem('activeProjectName', project.name);
            }
            router.push('/dashboard/overview');
        }
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
            return `${tierValue} / 24h`;
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
                "flex flex-col hover:shadow-lg transition-all card-gradient relative",
                project.facebookPageId ? 'card-gradient-blue' : 'card-gradient-green',
                selectionMode && 'cursor-pointer',
                isSelected && 'ring-2 ring-primary'
            )}
            onClick={handleCardClick}
        >
            {selectionMode && (
                <div className="absolute top-3 left-3 z-10">
                    <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onSelect?.(project._id.toString())}
                        className="h-5 w-5 bg-white"
                    />
                </div>
            )}
            <CardHeader className="pb-4">
                 <div className="flex justify-between items-start gap-2">
                    <CardTitle className={cn("text-base leading-tight font-semibold", selectionMode && 'pl-6')}>{project.name}</CardTitle>
                    <div className="flex items-center gap-1">
                        {project.reviewStatus && project.reviewStatus !== 'UNKNOWN' && (
                            <Badge variant={getReviewStatusVariant(project.reviewStatus)} className="capitalize text-xs flex-shrink-0">
                                {project.reviewStatus.replace(/_/g, ' ').toLowerCase()}
                            </Badge>
                        )}
                        {!selectionMode && <DeleteProjectButton projectId={project._id.toString()} projectName={project.name} />}
                    </div>
                </div>
                 <CardDescription className={cn("font-mono text-xs pt-1 break-all", selectionMode && 'pl-6')}>
                   {project.wabaId ? `WABA ID: ${project.wabaId}` : `Page ID: ${project.facebookPageId}`}
                </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2 flex-grow">
                 <div className="flex items-center gap-2 pt-1">
                    <Phone className="h-4 w-4" />
                    <span>{project.phoneNumbers?.length || 0} Phone Number(s)</span>
                </div>
                 <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {createdDate ? (
                        <span>Created: {createdDate}</span>
                    ) : (
                        <span className="h-4 w-24 bg-muted rounded animate-pulse" />
                    )}
                </div>
                 <div className="flex items-center gap-2">
                    <BarChart2 className="h-4 w-4" />
                     <span>Messaging Tier:</span>
                    {throughputLevel ? (
                         <Badge variant={getThroughputVariant(throughputLevel)} className="capitalize">
                            {formatThroughput(throughputLevel)}
                        </Badge>
                    ): (<span>N/A</span>)}
                </div>
                <div className="flex items-center gap-2">
                    <Webhook className="h-4 w-4" />
                    <span>Webhook:</span>
                    {webhookStatus ? (
                        <Badge variant={webhookStatus.isActive ? 'default' : 'destructive'}>
                            {webhookStatus.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                    ) : (
                        <Badge variant="secondary">Checking...</Badge>
                    )}
                </div>
            </CardContent>
            <CardFooter className="pt-4">
                <Button className="w-full flex-grow" size="sm" disabled={selectionMode}>
                    Select Project
                </Button>
            </CardFooter>
        </Card>
    );
});
