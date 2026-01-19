
'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { LoaderCircle, CheckSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { registerPhoneNumber } from '@/app/actions/whatsapp.actions';

interface RegisterPhoneButtonProps {
    projectId: string;
    phoneNumberId: string;
}

export function RegisterPhoneButton({ projectId, phoneNumberId }: RegisterPhoneButtonProps) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const handleRegister = () => {
        startTransition(async () => {
            const result = await registerPhoneNumber(projectId, phoneNumberId);
            if (result.success) {
                toast({ title: 'Success', description: result.message || 'Phone number registration request sent.' });
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        });
    };

    return (
        <Button onClick={handleRegister} disabled={isPending} variant="outline" size="sm">
            {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <CheckSquare className="mr-2 h-4 w-4" />}
            Register
        </Button>
    );
}
