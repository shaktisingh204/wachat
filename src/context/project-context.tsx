
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { WithId, Project, User, Plan } from '@/lib/definitions';
import { getProjectById, getProjects } from '@/app/actions/index.ts';
import { useToast } from '@/hooks/use-toast';

interface ProjectContextType {
    projects: WithId<Project>[];
    activeProject: WithId<Project> | null;
    activeProjectId: string | null;
    activeProjectName: string | null;
    isLoadingProject: boolean;
    sessionUser: (Omit<User, 'password'> & { _id: string, plan?: WithId<Plan> | null }) | null;
    setProjects: React.Dispatch<React.SetStateAction<WithId<Project>[]>>;
    setActiveProject: React.Dispatch<React.SetStateAction<WithId<Project> | null>>;
    setActiveProjectId: React.Dispatch<React.SetStateAction<string | null>>;
    reloadProject: () => void;
    reloadProjects: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ 
    children, 
    initialProjects, 
    user 
} : { 
    children: React.ReactNode, 
    initialProjects: WithId<Project>[], 
    user: (Omit<User, 'password'> & { _id: string, plan?: WithId<Plan> | null }) | null 
}) {
    const [projects, setProjects] = useState<WithId<Project>[]>(initialProjects || []);
    const [activeProject, setActiveProject] = useState<WithId<Project> | null>(null);
    const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
    const [activeProjectName, setActiveProjectName] = useState<string | null>(null);
    const [isLoadingProject, startProjectLoad] = useTransition();
    const router = useRouter();
    const pathname = usePathname();
    const { toast } = useToast();

    const reloadProjects = useCallback(async () => {
        try {
            const { projects: freshProjects } = await getProjects() || { projects: [] };
            setProjects(freshProjects);
        } catch (error) {
            console.error("Failed to reload projects:", error);
        }
    }, []);

    useEffect(() => {
        const storedId = localStorage.getItem('activeProjectId');
        const storedName = localStorage.getItem('activeProjectName');

        if (pathname === '/dashboard') {
            localStorage.removeItem('activeProjectId');
            localStorage.removeItem('activeProjectName');
            setActiveProjectId(null);
            setActiveProjectName(null);
            setActiveProject(null);
            // After a project is created, the user lands here. This is a good time to refresh the list.
            reloadProjects();
        } else if (storedId) {
            setActiveProjectId(storedId);
            setActiveProjectName(storedName);
            const project = projects?.find(p => p._id.toString() === storedId);
            if (project) {
                setActiveProject(project);
            } else if (pathname !== '/dashboard/setup' && pathname !== '/dashboard/bulk' && pathname !== '/dashboard/bulk/template') {
                 // If project is not in the list, it might be an invalid ID
                 reloadProject();
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname, projects]);

    const reloadProject = useCallback(() => {
        const storedId = localStorage.getItem('activeProjectId');
        if (storedId) {
            startProjectLoad(async () => {
                const projectData = await getProjectById(storedId);
                if (projectData) {
                    setActiveProject(projectData);
                    setActiveProjectName(projectData.name);
                } else {
                    toast({ title: 'Error', description: 'Could not load the selected project.', variant: 'destructive' });
                    localStorage.removeItem('activeProjectId');
                    localStorage.removeItem('activeProjectName');
                    setActiveProjectId(null);
                    router.push('/dashboard');
                }
            });
        }
    }, [router, toast]);


    return (
        <ProjectContext.Provider value={{ projects, setProjects, activeProject, activeProjectId, activeProjectName, isLoadingProject, sessionUser: user, setActiveProject, setActiveProjectId, reloadProject, reloadProjects }}>
            {children}
        </ProjectContext.Provider>
    );
}

export function useProject() {
    const context = useContext(ProjectContext);
    if (context === undefined) {
        throw new Error('useProject must be used within a ProjectProvider');
    }
    return context;
}
