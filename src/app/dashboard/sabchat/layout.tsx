
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { MessageSquare, Users as UsersIcon, BarChart, Wrench, Settings, Bot, HelpCircle, LifeBuoy, Inbox } from 'lucide-react';
import { SabChatIcon } from '@/components/wabasimplify/custom-sidebar-components';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';
import { useProject } from '@/context/project-context';
import { FeatureLock, FeatureLockOverlay } from '@/components/wabasimplify/feature-lock';

const navItems = [
    { href: "/dashboard/sabchat/inbox", label: "Inbox", icon: Inbox },
    { href: "/dashboard/sabchat/visitors", label: "Visitors", icon: UsersIcon },
    { href: "/dashboard/sabchat/analytics", label: "Analytics", icon: BarChart },
    { href: "/dashboard/sabchat/widget", label: "Widget Setup", icon: Wrench },
    { href: "/dashboard/sabchat/auto-reply", label: "Auto Reply", icon: Bot },
    { href: "/dashboard/sabchat/quick-replies", label: "Quick Replies", icon: LifeBuoy },
    { href: "/dashboard/sabchat/ai-replies", label: "AI Replies", icon: Bot },
    { href: "/dashboard/sabchat/faq", label: "FAQ", icon: HelpCircle },
    { href: "/dashboard/sabchat/settings", label: "Settings", icon: Settings },
];

function DevelopmentWarningDialog({ open, onOk, onExit }: { open: boolean, onOk: () => void, onExit: () => void }) {
    return (
        <AlertDialog open={open}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <div className="flex justify-center mb-4">
                        <AlertTriangle className="h-12 w-12 text-yellow-500" />
                    </div>
                    <AlertDialogTitle className="text-center">Under Development</AlertDialogTitle>
                    <AlertDialogDescription className="text-center">
                        This feature is currently in active development. Please use it at your own risk.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="sm:justify-center">
                    <Button variant="outline" onClick={onExit}>Exit</Button>
                    <Button onClick={onOk}>Ok, I understand</Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

export default function SabChatLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [showWarning, setShowWarning] = useState(true);
    const { sessionUser } = useProject();
    const isAllowed = sessionUser?.plan?.features?.chatbot ?? false;

    const handleExit = () => {
        setShowWarning(false);
        router.push('/dashboard');
    };
    
    return (
        <div className="w-full relative">
             <DevelopmentWarningDialog 
                open={showWarning}
                onOk={() => setShowWarning(false)}
                onExit={handleExit}
            />
            <FeatureLockOverlay isAllowed={isAllowed} featureName="sabChat" />
            <FeatureLock isAllowed={isAllowed}>
                 <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                            <SabChatIcon className="h-8 w-8 text-primary"/>
                            sabChat
                        </h1>
                        <p className="text-muted-foreground mt-2">
                            Your live chat and customer support suite.
                        </p>
                    </div>
                </div>
                <div className="flex justify-start items-center gap-1 border-b">
                    {navItems.map(item => {
                        const isActive = pathname === item.href;
                        return (
                            <Button key={item.href} asChild variant={isActive ? "secondary" : "ghost"} className="rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary">
                                <Link href={item.href}>
                                    <item.icon className="mr-2 h-4 w-4" />
                                    {item.label}
                                </Link>
                            </Button>
                        )
                    })}
                </div>
                <div className="mt-6">
                     {children}
                </div>
            </FeatureLock>
        </div>
    );
}
