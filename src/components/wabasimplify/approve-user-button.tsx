'use client';

import { ZoruButton } from '@/components/zoruui';
import { useTransition } from 'react';

import { LoaderCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { approveUser } from '@/app/actions/admin.actions';

interface ApproveUserButtonProps {
    userId: string;
}

export function ApproveUserButton({ userId }: ApproveUserButtonProps) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const handleApprove = () => {
        startTransition(async () => {
            const result = await approveUser(userId);
            if (result.success) {
                toast({ title: 'Success', description: 'User has been approved.' });
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        });
    };

    return (
        <ZoruButton onClick={handleApprove} disabled={isPending} size="sm">
            {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
            Approve
        </ZoruButton>
    );
}
