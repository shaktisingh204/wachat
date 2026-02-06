'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { PanelLeft } from 'lucide-react';

interface AdminHeaderProps {
    appRailPosition: 'left' | 'top';
    activeApp: string;
}

export function AdminHeader({ appRailPosition, activeApp }: AdminHeaderProps) {
    return (
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between gap-4 px-4 bg-transparent backdrop-blur-md">
            <div className="flex items-center gap-2">
                <SidebarTrigger>
                    <Button variant="ghost" size="icon" className="h-9 w-9">
                        <PanelLeft className="h-5 w-5 text-muted-foreground" />
                    </Button>
                </SidebarTrigger>

                <Link href="/dashboard" className="hidden font-bold sm:inline-block ml-2 text-lg tracking-tight">
                    SabNode
                </Link>
            </div>
        </header>
    );
}
