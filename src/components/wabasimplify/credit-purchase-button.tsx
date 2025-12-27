

'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { LoaderCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function SubmitButton({ children }: { children: React.ReactNode }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} className="w-full">
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            {children}
        </Button>
    )
}

interface CreditPurchaseButtonProps {
    credits: number;
    amount: number;
}

export function CreditPurchaseButton({ credits, amount }: CreditPurchaseButtonProps) {
    const { toast } = useToast();

    const handleClick = () => {
        toast({
            title: "Temporarily Disabled",
            description: "Purchasing credits is currently unavailable.",
            variant: "default",
        })
    }

    return (
        <Button onClick={handleClick} className="w-full">
            Buy Now
        </Button>
    );
}