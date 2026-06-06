'use client';

import * as React from 'react';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

import { Button, useToast } from '@/components/sabcrm/20ui';

import { runSabmonitorCheckNow } from '@/app/actions/sabmonitor.actions';

export function RunNowButton({ checkId }: { checkId: string }): React.JSX.Element {
    const [pending, startTransition] = useTransition();
    const router = useRouter();
    const { toast } = useToast();

    return (
        <Button
            iconLeft={RefreshCw}
            loading={pending}
            onClick={() =>
                startTransition(async () => {
                    try {
                        await runSabmonitorCheckNow(checkId);
                        router.refresh();
                        toast.success('Check queued to run now');
                    } catch (e) {
                        toast.error((e as Error).message || 'Could not run the check');
                    }
                })
            }
        >
            Run now
        </Button>
    );
}
