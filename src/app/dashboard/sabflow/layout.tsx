
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

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

export default function SabFlowLayout({ children }: { children: React.ReactNode }) {
    const [showWarning, setShowWarning] = useState(true);
    const router = useRouter();

    const handleExit = () => {
        setShowWarning(false);
        router.push('/dashboard');
    };
    
    return (
        <div className="w-full h-full">
            <DevelopmentWarningDialog 
                open={showWarning}
                onOk={() => setShowWarning(false)}
                onExit={handleExit}
            />
            {children}
        </div>
    );
}
