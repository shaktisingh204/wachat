'use client';

import * as React from 'react';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/sabcrm/20ui';

import { runSabmonitorCheckNow } from '@/app/actions/sabmonitor.actions';

export function RunNowButton({ checkId }: { checkId: string }): React.JSX.Element {
    const [pending, startTransition] = useTransition();
    const router = useRouter();
    return (
        <Button
            onClick={() =>
                startTransition(async () => {
                    try {
                        await runSabmonitorCheckNow(checkId);
                        router.refresh();
                    } catch (e) {
                        window.alert((e as Error).message);
                    }
                })
            }
            disabled={pending}
        >
            {pending ? 'Running…' : 'Run now'}
        </Button>
    );
}
