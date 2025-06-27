
'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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


    return (
        <Card className="flex flex-col justify-between hover:shadow-lg hover:border-primary transition-all">
            <CardHeader>
                <div className="flex justify-between items-start gap-2">
                    <CardTitle className="break-all">{project.name}</CardTitle>
                    {project.reviewStatus && project.reviewStatus !== 'UNKNOWN' && (
                        <Badge variant={getReviewStatusVariant(project.reviewStatus)} className="capitalize flex-shrink-0">
                            {project.reviewStatus.replace(/_/g, ' ').toLowerCase()}
                        </Badge>
                    )}
                </div>
                <CardDescription>WABA ID: {project.wabaId}</CardDescription>
            </CardHeader>
            <CardContent>
                <Button className="w-full" onClick={handleSelectProject}>
                    Select Project
                </Button>
            </CardContent>
        </Card>
    );
}
