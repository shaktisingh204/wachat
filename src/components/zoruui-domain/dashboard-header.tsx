'use client';

import { Avatar, ZoruAvatarFallback, ZoruAvatarImage, Button } from '@/components/sabcrm/20ui/compat';
import {
  useProject } from '@/context/project-context';
import { Bell, Sparkles } from 'lucide-react';

import { useEffect, useState } from 'react';

export function DashboardHeader() {
    const { sessionUser, projects } = useProject();
    const [greeting, setGreeting] = useState('Welcome back');

    useEffect(() => {
        const hour = new Date().getHours();
        if (hour < 12) setGreeting('Good morning');
        else if (hour < 18) setGreeting('Good afternoon');
        else setGreeting('Good evening');
    }, []);

    if (!sessionUser) return null;

    const initials = sessionUser.name
        ?.split(' ')
        .map((n: string) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'U';

    return (
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zoru-line/40 pb-6 mb-8">
            <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14 border-2 border-primary/20 ring-4 ring-primary/5">
                    <ZoruAvatarImage src={sessionUser.image || ''} />
                    <ZoruAvatarFallback className="bg-zoru-ink/10 text-zoru-ink font-bold">{initials}</ZoruAvatarFallback>
                </Avatar>
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-2">
                        {greeting}, {sessionUser.name?.split(' ')[0]} <Sparkles className="h-5 w-5 text-zoru-ink fill-zoru-ink animate-pulse" />
                    </h1>
                    <p className="text-zoru-ink-muted mt-1">
                        You have <span className="font-semibold text-zoru-ink">{projects.length} active projects</span> in your workspace.
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-3">
                {/* System Status / Global Actions could go here */}
                <Button variant="outline" size="sm" className="gap-2 hidden md:flex">
                    <Bell className="h-4 w-4" /> Notifications
                </Button>
            </div>
        </div>
    );
}
