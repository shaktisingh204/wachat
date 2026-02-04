'use client';

import * as React from 'react';
import Link from 'next/link';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { PanelLeft, LogOut } from 'lucide-react';
import { useProject } from '@/context/project-context';
import { appIcons } from '@/config/dashboard-config';

interface AdminHeaderProps {
    appRailPosition: 'left' | 'top';
    activeApp: string;
}

export function AdminHeader({ appRailPosition, activeApp }: AdminHeaderProps) {
    const { activeProjectName, sessionUser } = useProject();

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

                {appRailPosition === 'top' && (
                    <>
                        <Separator orientation="vertical" className="h-6 mx-2 hidden md:block" />
                        <nav className="hidden items-center gap-1 md:flex">
                            {appIcons.map(app => (
                                <Button key={app.id} asChild variant={activeApp === app.id ? 'secondary' : 'ghost'} size="sm" className="h-8">
                                    <Link href={app.href} className="flex items-center gap-2">
                                        <app.icon className="h-4 w-4" />
                                        {app.label}
                                    </Link>
                                </Button>
                            ))}
                        </nav>
                    </>
                )}
            </div>

            <div className="flex items-center gap-3">
                <div className="font-medium text-sm hidden md:block text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-full border border-white/10">
                    {activeProjectName}
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="relative h-10 w-10 rounded-full ring-2 ring-white/20 hover:ring-white/40 transition-all">
                            <Avatar>
                                <AvatarImage src={sessionUser?.image || `https://i.pravatar.cc/150?u=${sessionUser?.email}`} />
                                <AvatarFallback>{sessionUser?.name?.charAt(0) || 'U'}</AvatarFallback>
                            </Avatar>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>My Account</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild><Link href="/dashboard/user/settings/profile">Profile</Link></DropdownMenuItem>
                        <DropdownMenuItem asChild><Link href="/dashboard/user/billing">Billing</Link></DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <Link href="/api/auth/logout" className="text-red-500 focus:text-red-500">
                                <LogOut className="mr-2 h-4 w-4" />
                                Logout
                            </Link>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
}
