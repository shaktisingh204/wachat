'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

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

    return (
        <Card className="flex flex-col justify-between hover:shadow-lg hover:border-primary transition-all">
            <CardHeader>
                <CardTitle>{project.name}</CardTitle>
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
