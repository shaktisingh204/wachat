'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useTransition, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { WithId } from 'mongodb';
import type { Project, User, Plan } from '@/lib/definitions';
import { getProjectById, getProjects } from '@/app/actions/project.actions';
import { getMyEffectivePermissions } from '@/app/actions/rbac.actions';
import { can, type EffectivePermissions, type PermissionAction } from '@/lib/rbac';
import { useToast } from '@/hooks/use-toast';

interface ProjectContextType {
    projects: WithId<Project>[];
    activeProject: WithId<Project> | null;
    activeProjectId: string | null;
    activeProjectName: string | null;
    isLoadingProject: boolean;
    sessionUser: (Omit<User, 'password'> & { _id: string, plan?: WithId<Plan> | null }) | null;
    effectivePermissions: EffectivePermissions | null;
    setProjects: React.Dispatch<React.SetStateAction<WithId<Project>[]>>;
    setActiveProjectId: React.Dispatch<React.SetStateAction<string | null>>;
    reloadProject: () => void;
    reloadProjects: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({
    children,
    initialProjects,
    user
}: {
    children: React.ReactNode,
    initialProjects: WithId<Project>[],
    user: (Omit<User, 'password'> & { _id: string, plan?: WithId<Plan> | null }) | null
}) {
    const [projects, setProjects] = useState<WithId<Project>[]>(initialProjects || []);
    const [activeProjectId, setActiveProjectIdState] = useState<string | null>(() => {
        if (typeof window === 'undefined') return null;
        try { return localStorage.getItem('activeProjectId'); } catch { return null; }
    });
    const [activeProjectName, setActiveProjectName] = useState<string | null>(() => {
        if (typeof window === 'undefined') return null;
        try { return localStorage.getItem('activeProjectName'); } catch { return null; }
    });

    /**
     * Wrap the active-project setter so every caller persists to
     * localStorage. Historically each callsite (picker, sidebar, dashboard,
     * project card, project switcher) wrote to localStorage by hand — some
     * pickers forgot to, which is why pick → refresh used to drop the
     * selection.
     */
    const setActiveProjectId = useCallback<React.Dispatch<React.SetStateAction<string | null>>>(
        (value) => {
            setActiveProjectIdState((prev) => {
                const next = typeof value === 'function'
                    ? (value as (p: string | null) => string | null)(prev)
                    : value;
                try {
                    if (next) {
                        localStorage.setItem('activeProjectId', next);
                        // Best-effort: lookup the matching name from the
                        // current projects list and persist that too so the
                        // shell header doesn't flash "Untitled" on refresh.
                        const match = projects.find(
                            (p) => p._id.toString() === next,
                        );
                        if (match?.name) {
                            localStorage.setItem('activeProjectName', match.name);
                            setActiveProjectName(match.name);
                        }
                    } else {
                        localStorage.removeItem('activeProjectId');
                        localStorage.removeItem('activeProjectName');
                        setActiveProjectName(null);
                    }
                } catch {
                    /* localStorage unavailable (SSR / private mode) — fall through */
                }
                return next;
            });
        },
        [projects],
    );
    const [isLoadingProject, startProjectLoad] = useTransition();
    const [effectivePermissions, setEffectivePermissions] = useState<EffectivePermissions | null>(null);
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
            const freshProjects = await getProjects() || [];
            setProjects(freshProjects);
        } catch (error) {
            console.error("Failed to reload projects:", error);
        }
    }, []);

    useEffect(() => {
        const storedId = localStorage.getItem('activeProjectId');
        const storedName = localStorage.getItem('activeProjectName');

        if (pathname === '/wachat' || pathname === '/dashboard/facebook/all-projects') {
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
                    router.push('/wachat');
                }
            });
        }
    }, [router, toast]);

    // Reload effective permissions whenever the active project changes.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const perms = await getMyEffectivePermissions(activeProjectId);
                if (!cancelled) setEffectivePermissions(perms);
            } catch {
                if (!cancelled) setEffectivePermissions(null);
            }
        })();
        return () => { cancelled = true; };
    }, [activeProjectId, user?._id]);

    // Self-hydrate the active project. The SSR seed (`initialProjects`)
    // can lag behind reality — recently-changed projects, projects added
    // after the layout mounted, or projects the cached list does not
    // include yet — leaving `activeProject` either stale or null even
    // though the project exists in Mongo. Refetch on every activeProjectId
    // change so consumers (broadcast form, cron, etc.) get fresh
    // phoneNumbers / tags / settings without each page hand-rolling its
    // own fetch.
    useEffect(() => {
        if (!activeProjectId) return;
        let cancelled = false;
        startProjectLoad(async () => {
            const projectData = await getProjectById(activeProjectId);
            if (cancelled || !projectData) return;
            setProjects(prev => {
                const idx = prev.findIndex(
                    p => p._id.toString() === projectData._id.toString(),
                );
                if (idx === -1) return [...prev, projectData];
                const next = [...prev];
                next[idx] = projectData;
                return next;
            });
        });
        return () => { cancelled = true; };
    }, [activeProjectId]);

    return (
        <ProjectContext.Provider value={{ projects, setProjects, activeProject, activeProjectId, activeProjectName, isLoadingProject, sessionUser: user, effectivePermissions, setActiveProjectId, reloadProject, reloadProjects }}>
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

/**
 * Non-throwing variant for shared chrome (e.g. SabHomeShell) that renders in
 * both project-scoped trees (dashboard, wachat, sabsms) and
 * user-scoped ones with no ProjectProvider (sabpay). Returns `null` when no
 * provider is mounted; callers treat that as "acting on the user's own
 * account" (owner semantics, no team-member gating).
 */
export function useOptionalProject() {
    return useContext(ProjectContext) ?? null;
}

/**
 * Declarative permission check for components.
 * Returns true when the current user can perform `action` on `moduleKey`
 * in the active project (owner bypass + plan ceiling handled in rbac.ts).
 */
export function useCan(moduleKey: string, action: PermissionAction = 'view'): boolean {
    const { effectivePermissions } = useProject();
    return can(effectivePermissions, moduleKey, action);
}
