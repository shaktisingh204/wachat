'use client';

import { useFormStatus } from 'react-dom';
import { Button } from '@/components/sabcrm/20ui';
import { LoaderCircle, Save } from 'lucide-react';

export function SubmitButton() {
    const { pending } = useFormStatus();
    const Icon = pending ? LoaderCircle : Save;
    return (
        <Button type="submit" disabled={pending}>
            <Icon size={16} aria-hidden="true" className={pending ? 'animate-spin' : undefined} />
            Save preferences
        </Button>
    );
}
