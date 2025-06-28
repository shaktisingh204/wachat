
'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, Calendar } from 'lucide-react';

interface ProjectCardProps {
    project: any;
}

export function ProjectCard({ project }: ProjectCardProps) {
    const router = useRouter();

    const handleSelectProject = () => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('activeProjectId', project._id);
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

    const throughputLevel = project.phoneNumbers?.[0]?.throughput?.level;

    return (
        <Card className="flex flex-col justify-between hover:shadow-lg hover:border-primary transition-all">
            <CardHeader className="flex-grow">
                <div className="flex justify-between items-start gap-2">
                    <CardTitle className="text-base leading-tight">{project.name}</CardTitle>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        {project.reviewStatus && project.reviewStatus !== 'UNKNOWN' && (
                            <Badge variant={getReviewStatusVariant(project.reviewStatus)} className="capitalize text-xs">
                                {project.reviewStatus.replace(/_/g, ' ').toLowerCase()}
                            </Badge>
                        )}
                        {throughputLevel && (
                             <Badge variant="outline" className="capitalize text-xs">
                                {formatThroughput(throughputLevel)}
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
                        <span>Created: {new Date(project.createdAt).toLocaleDateString()}</span>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-0">
                <Button className="w-full" size="sm" onClick={handleSelectProject}>
                    Select Project
                </Button>
            </CardContent>
        </Card>
    );
}
