'use client';

import { useFormStatus } from 'react-dom';
import { Button } from '@/components/sabcrm/20ui';
import { LoaderCircle, Save } from 'lucide-react';

export function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Preferences
        </Button>
    )
}
