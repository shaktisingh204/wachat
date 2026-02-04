
'use client';

import { usePathname, useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { SabChatIcon } from '@/components/wabasimplify/custom-sidebar-components';
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useProject } from '@/context/project-context';
import { FeatureLock, FeatureLockOverlay } from '@/components/wabasimplify/feature-lock';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

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

    const isInbox = pathname === '/dashboard/sabchat/inbox';

    return (
        <div className={cn("w-full relative", isInbox ? "h-full" : "")}>
            <DevelopmentWarningDialog
                open={showWarning}
                onOk={() => setShowWarning(false)}
                onExit={handleExit}
            />
            <FeatureLockOverlay isAllowed={isAllowed} featureName="sabChat" />
            <FeatureLock isAllowed={isAllowed}>
                {!isInbox && (
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                        <div>
                            <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                                <SabChatIcon className="h-8 w-8 text-primary" />
                                sabChat
                            </h1>
                            <p className="text-muted-foreground mt-2">
                                Your live chat and customer support suite.
                            </p>
                        </div>
                    </div>
                )}
                <div className={cn(isInbox ? "h-full" : "mt-6")}>
                    {children}
                </div>
            </FeatureLock>
        </div>
    );
}
