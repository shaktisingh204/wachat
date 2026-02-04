'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import {
    Inbox,
    Send,
    File,
    Trash2,
    Archive,
    AlertOctagon,
    Plus,
    Tag
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface SidebarItem {
    label: string;
    icon: React.ElementType;
    id: string;
    variant?: 'default' | 'ghost';
    count?: number;
}

const mainItems: SidebarItem[] = [
    { label: 'Inbox', icon: Inbox, id: 'inbox', count: 12 },
    { label: 'Sent', icon: Send, id: 'sent' },
    { label: 'Drafts', icon: File, id: 'drafts', count: 2 },
    { label: 'Archive', icon: Archive, id: 'archive' },
    { label: 'Trash', icon: Trash2, id: 'trash' },
    { label: 'Spam', icon: AlertOctagon, id: 'spam' },
];

const labels = [
    { label: 'Personal', color: 'bg-red-500' },
    { label: 'Work', color: 'bg-blue-500' },
    { label: 'Finance', color: 'bg-green-500' },
];

export function EmailSidebar() {
    const searchParams = useSearchParams();
    const currentFolder = searchParams.get('folder') || 'inbox';

    return (
        <div className="flex flex-col h-full bg-background border-r py-4 px-2 gap-4">
            <div className="px-2">
                <Button className="w-full justify-start gap-2" size="lg" asChild>
                    <Link href="?compose=new">
                        <Plus className="w-5 h-5" />
                        <span className="font-semibold">Compose</span>
                    </Link>
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 px-2">
                <div className="space-y-1">
                    {mainItems.map((item) => {
                        const newParams = new URLSearchParams(searchParams.toString());
                        newParams.set('folder', item.id);
                        return (
                            <Button
                                key={item.id}
                                variant={currentFolder === item.id ? 'secondary' : 'ghost'}
                                className={cn(
                                    "w-full justify-between font-normal",
                                    currentFolder === item.id && "font-semibold"
                                )}
                                asChild
                            >
                                <Link href={`?${newParams.toString()}`}>
                                    <div className="flex items-center gap-3">
                                        <item.icon className="w-4 h-4" />
                                        {item.label}
                                    </div>
                                    {item.count && (
                                        <span className="text-xs text-muted-foreground bg-muted-foreground/10 px-2 py-0.5 rounded-full">
                                            {item.count}
                                        </span>
                                    )}
                                </Link>
                            </Button>
                        )
                    })}
                </div>

                <div className="space-y-1">
                    <h4 className="text-xs font-semibold text-muted-foreground px-4 mb-2 uppercase tracking-wider">
                        Labels
                    </h4>
                    {labels.map((item) => (
                        <Button
                            key={item.label}
                            variant="ghost"
                            className="w-full justify-start font-normal"
                        >
                            <div className={cn("w-2 h-2 rounded-full mr-3", item.color)} />
                            {item.label}
                        </Button>
                    ))}
                </div>
            </div>

            {/* User Account / Footer could go here */}
        </div>
    );
}
