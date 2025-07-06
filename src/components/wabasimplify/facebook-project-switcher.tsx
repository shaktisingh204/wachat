
'use client';

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Briefcase, Check, ChevronsUpDown } from 'lucide-react';
import type { WithId, Project } from '@/lib/definitions';

interface FacebookProjectSwitcherProps {
    projects: WithId<Project>[];
    activeProject?: WithId<Project>;
}

export function FacebookProjectSwitcher({ projects, activeProject }: FacebookProjectSwitcherProps) {
    const router = useRouter();
    const pathname = usePathname();

    const handleSelectProject = (project: WithId<Project>) => {
        if (project._id.toString() === activeProject?._id.toString()) return;

        localStorage.setItem('activeProjectId', project._id.toString());
        localStorage.setItem('activeProjectName', project.name);
        router.refresh();
    }

    if (!activeProject) {
        return (
            <div className="hidden md:flex items-center gap-2 text-sm font-semibold text-primary">
                <Briefcase className="h-4 w-4" />
                <span>No Project Selected</span>
            </div>
        )
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={`https://graph.facebook.com/${activeProject.facebookPageId}/picture?type=square`} alt={activeProject.name} />
                        <AvatarFallback>{activeProject.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="hidden md:inline font-semibold">{activeProject.name}</span>
                    <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
                <DropdownMenuLabel>Switch Project</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {projects.map(project => (
                    <DropdownMenuItem key={project._id.toString()} onSelect={() => handleSelectProject(project)}>
                        <Avatar className="h-6 w-6 mr-2">
                            <AvatarImage src={`https://graph.facebook.com/${project.facebookPageId}/picture?type=square`} alt={project.name} />
                            <AvatarFallback>{project.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span>{project.name}</span>
                        {project._id.toString() === activeProject._id.toString() && <Check className="ml-auto h-4 w-4" />}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
