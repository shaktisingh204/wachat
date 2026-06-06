'use client';

import {
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  Button,
  Avatar,
  ZoruAvatarFallback,
  ZoruAvatarImage,
  Switch,
} from '@/components/sabcrm/20ui/compat';
import {
  useRouter,
  usePathname } from 'next/navigation';

import * as React from 'react';

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
            <div className="hidden md:flex items-center gap-2 text-sm font-semibold text-[var(--st-text)]">
                <Briefcase className="h-4 w-4" />
                <span>No Project Selected</span>
            </div>
        )
    }

    return (
        <DropdownMenu>
            <ZoruDropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                        <ZoruAvatarImage src={`https://graph.facebook.com/${activeProject.facebookPageId}/picture?type=square`} alt={activeProject.name} />
                        <ZoruAvatarFallback>{activeProject.name.charAt(0)}</ZoruAvatarFallback>
                    </Avatar>
                    <span className="hidden md:inline font-semibold">{activeProject.name}</span>
                    <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </Button>
            </ZoruDropdownMenuTrigger>
            <ZoruDropdownMenuContent align="start">
                <ZoruDropdownMenuLabel>Switch Project</ZoruDropdownMenuLabel>
                <ZoruDropdownMenuSeparator />
                {projects.map(project => (
                    <ZoruDropdownMenuItem key={project._id.toString()} onSelect={() => handleSelectProject(project)}>
                        <Avatar className="h-6 w-6 mr-2">
                            <ZoruAvatarImage src={`https://graph.facebook.com/${project.facebookPageId}/picture?type=square`} alt={project.name} />
                            <ZoruAvatarFallback>{project.name.charAt(0)}</ZoruAvatarFallback>
                        </Avatar>
                        <span>{project.name}</span>
                        {project._id.toString() === activeProject._id.toString() && <Check className="ml-auto h-4 w-4" />}
                    </ZoruDropdownMenuItem>
                ))}
            </ZoruDropdownMenuContent>
        </DropdownMenu>
    );
}
