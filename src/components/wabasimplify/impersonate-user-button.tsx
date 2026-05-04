'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { LogIn } from 'lucide-react';
import { impersonateUser } from '@/app/actions/admin.actions';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

interface ImpersonateUserButtonProps {
    userId: string;
    userName: string;
}

export function ImpersonateUserButton({ userId, userName }: ImpersonateUserButtonProps) {
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const { toast } = useToast();

    const handleImpersonate = async () => {
        setIsLoading(true);
        try {
            const result = await impersonateUser(userId);
            if (result.success) {
                toast({
                    title: "Success",
                    description: `Logged in as ${userName}`,
                });
                // Force a hard reload to pick up the new session cookie
                window.location.href = '/wachat';
            } else {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: result.error || 'Failed to impersonate user',
                });
                setIsLoading(false);
            }
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: 'An unexpected error occurred',
            });
            setIsLoading(false);
        }
    };

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={handleImpersonate}
            disabled={isLoading}
            title={`Login as ${userName}`}
        >
            <LogIn className="h-4 w-4" />
        </Button>
    );
}
