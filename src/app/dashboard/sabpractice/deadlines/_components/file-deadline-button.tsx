'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';

import { Button, useToast } from '@/components/sabcrm/20ui';
import { markSabpracticeDeadlineFiled } from '@/app/actions/sabpractice.actions';

export function FileDeadlineButton({ id }: { id: string }) {
    const router = useRouter();
    const { toast } = useToast();
    const [pending, start] = React.useTransition();
    return (
        <Button
            size="sm"
            variant="outline"
            iconLeft={Check}
            loading={pending}
            onClick={() =>
                start(async () => {
                    try {
                        await markSabpracticeDeadlineFiled(id);
                        toast.success('Deadline marked filed');
                        router.refresh();
                    } catch {
                        toast.error('Could not update the deadline. Please try again.');
                    }
                })
            }
        >
            Mark filed
        </Button>
    );
}
