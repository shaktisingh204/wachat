'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/sabcrm/20ui/compat';

import { joinSabConnectGroup, leaveSabConnectGroup } from '@/app/actions/sabconnect.actions';

interface Props {
    groupId: string;
    memberIds: string[];
    /**
     * If the parent already knows whether the viewer is a member it can
     * pass it in. Otherwise we fall back to "Join" and let the server
     * de-dupe via $addToSet.
     */
    isMember?: boolean;
}

export function GroupMembershipButton({ groupId, isMember }: Props) {
    const router = useRouter();
    const [optimistic, setOptimistic] = useState<boolean | undefined>(isMember);
    const [pending, startTransition] = useTransition();

    const onClick = () => {
        startTransition(async () => {
            if (optimistic) {
                setOptimistic(false);
                const res = await leaveSabConnectGroup(groupId);
                if ('error' in res) setOptimistic(true);
            } else {
                setOptimistic(true);
                const res = await joinSabConnectGroup(groupId);
                if ('error' in res) setOptimistic(false);
            }
            router.refresh();
        });
    };

    return (
        <Button onClick={onClick} disabled={pending} variant={optimistic ? 'outline' : 'default'}>
            {optimistic ? 'Leave group' : 'Join group'}
        </Button>
    );
}
