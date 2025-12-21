
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useTransition, useMemo } from 'react';
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
    const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
    const [activeProjectName, setActiveProjectName] = useState<string | null>(null);
    const [isLoadingProject, startProjectLoad] = useTransition();
    const router = useRouter();
    const pathname = usePathname();
    const { toast } = useToast();

    // Memoize the activeProject to prevent it from being re-created on every render
    const activeProject = useMemo(() => {
        if (!activeProjectId || !projects) return null;
        return projects.find(p => p._id.toString() === activeProjectId) || null;
    }, [activeProjectId, projects]);

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
        } else if (storedId) {
            setActiveProjectId(storedId);
            setActiveProjectName(storedName);
        }
    }, [pathname]);

    const reloadProject = useCallback(() => {
        const storedId = localStorage.getItem('activeProjectId');
        if (storedId) {
            startProjectLoad(async () => {
                const projectData = await getProjectById(storedId);
                if (projectData) {
                    setProjects(prevProjects => {
                        const existing = prevProjects.find(p => p._id.toString() === projectData._id.toString());
                        if (existing) {
                            return prevProjects.map(p => p._id.toString() === projectData._id.toString() ? projectData : p);
                        }
                        return [...prevProjects, projectData];
                    });
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
        <ProjectContext.Provider value={{ projects, setProjects, activeProject, activeProjectId, activeProjectName, isLoadingProject, sessionUser: user, setActiveProject: () => {}, setActiveProjectId, reloadProject, reloadProjects }}>
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
