
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
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
import { useProject } from '@/context/project-context';
import { WhatsAppIcon } from './custom-sidebar-components';

export function ProjectSwitcher() {
    const { projects: allProjects, activeProject, activeProjectId, setActiveProjectId } = useProject();
    const router = useRouter();

    // This component is for WhatsApp projects, so filter them.
    const projects = allProjects.filter(p => !!p.wabaId);

    const handleSelectProject = (project: WithId<Project>) => {
        if (project._id.toString() === activeProjectId) return;

        localStorage.setItem('activeProjectId', project._id.toString());
        localStorage.setItem('activeProjectName', project.name);
        setActiveProjectId(project._id.toString());
        router.push('/dashboard/overview'); // Navigate to a safe page after switching
        router.refresh();
    };

    if (!activeProject) {
        return (
            <div className="flex w-full items-center gap-2 text-sm font-semibold text-primary px-2">
                <Briefcase className="h-4 w-4" />
                <span className="truncate">No Project Selected</span>
            </div>
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start h-auto p-2">
                    <div className="flex items-center gap-2 w-full">
                        <Avatar className="h-8 w-8">
                           <AvatarFallback><WhatsAppIcon className="h-5 w-5"/></AvatarFallback>
                        </Avatar>
                        <span className="truncate flex-1 text-left font-semibold">{activeProject.name}</span>
                        <ChevronsUpDown className="h-4 w-4 opacity-50 flex-shrink-0" />
                    </div>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
                <DropdownMenuLabel>Switch Project</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {projects.map(project => (
                    <DropdownMenuItem key={project._id.toString()} onSelect={() => handleSelectProject(project)}>
                         <WhatsAppIcon className="mr-2 h-4 w-4" />
                        <span className="truncate">{project.name}</span>
                        {project._id.toString() === activeProject._id.toString() && <Check className="ml-auto h-4 w-4" />}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
