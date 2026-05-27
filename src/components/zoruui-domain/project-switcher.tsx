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
  Switch,
} from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';

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
        // `router.push` already triggers a fresh RSC fetch for the
        // destination — calling `router.refresh()` here doubled the work
        // and made project switching feel sluggish.
        router.push('/wachat/overview');
    };

    if (!activeProject) {
        return (
            <div className="flex w-full items-center gap-2 text-sm font-semibold text-zoru-ink px-2">
                <Briefcase className="h-4 w-4" />
                <span className="truncate">No Project Selected</span>
            </div>
        );
    }

    return (
        <DropdownMenu>
            <ZoruDropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start h-auto p-2">
                    <div className="flex items-center gap-2 w-full">
                        <Avatar className="h-8 w-8">
                           <ZoruAvatarFallback><WhatsAppIcon className="h-5 w-5"/></ZoruAvatarFallback>
                        </Avatar>
                        <span className="truncate flex-1 text-left font-semibold">{activeProject.name}</span>
                        <ChevronsUpDown className="h-4 w-4 opacity-50 flex-shrink-0" />
                    </div>
                </Button>
            </ZoruDropdownMenuTrigger>
            <ZoruDropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
                <ZoruDropdownMenuLabel>Switch Project</ZoruDropdownMenuLabel>
                <ZoruDropdownMenuSeparator />
                {projects.map(project => (
                    <ZoruDropdownMenuItem key={project._id.toString()} onSelect={() => handleSelectProject(project)}>
                         <WhatsAppIcon className="mr-2 h-4 w-4" />
                        <span className="truncate">{project.name}</span>
                        {project._id.toString() === activeProject._id.toString() && <Check className="ml-auto h-4 w-4" />}
                    </ZoruDropdownMenuItem>
                ))}
            </ZoruDropdownMenuContent>
        </DropdownMenu>
    );
}
