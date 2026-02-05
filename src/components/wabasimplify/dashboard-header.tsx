'use client';

import { useProject } from '@/context/project-context';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Bell, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/40 pb-6 mb-8">
            <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14 border-2 border-primary/20 ring-4 ring-primary/5">
                    <AvatarImage src={sessionUser.image || ''} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">{initials}</AvatarFallback>
                </Avatar>
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-2">
                        {greeting}, {sessionUser.name?.split(' ')[0]} <Sparkles className="h-5 w-5 text-yellow-500 fill-yellow-500 animate-pulse" />
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        You have <span className="font-semibold text-foreground">{projects.length} active projects</span> in your workspace.
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
