

'use client';

import { useRouter } from 'next/navigation';
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, Calendar } from 'lucide-react';
import { SubscribeProjectButton } from './subscribe-project-button';
import { cn } from '@/lib/utils';
import type { WithId, Project } from '@/lib/definitions';


interface ProjectCardProps {
    project: WithId<Project>;
}

export const ProjectCard = React.memo(function ProjectCard({ project }: ProjectCardProps) {
    const router = useRouter();
    const [createdDate, setCreatedDate] = useState<string | null>(null);

    useEffect(() => {
        // This runs only on the client, after hydration, preventing a mismatch
        setCreatedDate(new Date(project.createdAt).toLocaleDateString());
    }, [project.createdAt]);

    const handleSelectProject = () => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('activeProjectId', project._id.toString());
            localStorage.setItem('activeProjectName', project.name);
        }
        router.push('/dashboard/overview');
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
        <Card className={cn("flex flex-col hover:shadow-lg hover:border-primary transition-all card-gradient card-gradient-green")}>
            <CardHeader className="flex-grow">
                <div className="flex justify-between items-start gap-2">
                    <CardTitle className="text-base leading-tight">{project.name}</CardTitle>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        {project.violationType && (
                             <Badge variant="destructive" className="capitalize">
                                Violation: {project.violationType}
                            </Badge>
                        )}
                        {project.banState && (
                            <Badge variant="destructive" className="capitalize">
                                {project.banState.replace(/_/g, ' ')}
                            </Badge>
                        )}
                        {project.reviewStatus && project.reviewStatus !== 'UNKNOWN' && (
                            <Badge variant={getReviewStatusVariant(project.reviewStatus)} className="capitalize text-xs">
                                {project.reviewStatus.replace(/_/g, ' ').toLowerCase()}
                            </Badge>
                        )}
                    </div>
                </div>
                <div className="space-y-2 pt-2 text-xs text-muted-foreground">
                    <p className="font-mono break-all leading-tight">
                       <span className="font-sans font-medium">WABA ID:</span> {project.wabaId}
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                        <Phone className="h-3 w-3" />
                        <span>{project.phoneNumbers?.length || 0} Phone Number(s)</span>
                    </div>
                     <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        {createdDate ? (
                            <span>Created: {createdDate}</span>
                        ) : (
                            <span className="h-4 w-24 bg-muted rounded animate-pulse" />
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-0 flex flex-col justify-end">
                <div className="flex justify-center mb-4 mt-2">
                    {throughputLevel && (
                         <Badge variant={getThroughputVariant(throughputLevel)} className="capitalize">
                            {formatThroughput(throughputLevel)}
                        </Badge>
                    )}
                </div>
                <div className="flex items-stretch gap-2">
                    <SubscribeProjectButton projectId={project._id.toString()} />
                    <Button className="w-full flex-grow" size="sm" onClick={handleSelectProject}>
                        Select Project
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
});
