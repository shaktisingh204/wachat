'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/zoruui';
import { markSabpracticeDeadlineFiled } from '@/app/actions/sabpractice.actions';

export function FileDeadlineButton({ id }: { id: string }) {
    const router = useRouter();
    const [pending, start] = React.useTransition();
    return (
        <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
                start(async () => {
                    await markSabpracticeDeadlineFiled(id);
                    router.refresh();
                })
            }
        >
            {pending ? 'Filing…' : 'Mark filed'}
        </Button>
    );
}
