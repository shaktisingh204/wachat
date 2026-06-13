'use client';

/**
 * Resolve the owner + collaborators of a list of nodes into render-ready
 * `SabFileMember[]` keyed by node id. Batches every unique user id into a
 * single `getUserProfiles` call, so a whole table costs one round-trip.
 */
import * as React from 'react';

import { getUserProfiles } from '@/app/actions/sabfiles.actions';

import type { SabfilesNode, SabFileMember, SabFileRole } from './types';

export function useNodeMembers(nodes: SabfilesNode[]): Record<string, SabFileMember[]> {
    const [map, setMap] = React.useState<Record<string, SabFileMember[]>>({});

    // A signature that changes whenever the owner/member sets change.
    const sig = nodes
        .map(
            (n) =>
                `${n.id}#${n.userId}#${(n.members ?? [])
                    .map((m) => `${m.userId}:${m.role}`)
                    .join('|')}`,
        )
        .join(',');

    React.useEffect(() => {
        const ids = new Set<string>();
        for (const n of nodes) {
            if (n.userId) ids.add(n.userId);
            for (const m of n.members ?? []) if (m.userId) ids.add(m.userId);
        }
        if (ids.size === 0) {
            setMap({});
            return;
        }
        let cancelled = false;
        void getUserProfiles(Array.from(ids)).then((res) => {
            if (cancelled) return;
            const profiles = res.profiles ?? {};
            const next: Record<string, SabFileMember[]> = {};
            for (const n of nodes) {
                const members: SabFileMember[] = [];
                const ownerP = profiles[n.userId];
                if (ownerP) {
                    members.push({
                        userId: n.userId,
                        name: ownerP.name || ownerP.email,
                        email: ownerP.email,
                        image: ownerP.image,
                        role: 'owner',
                        isOwner: true,
                    });
                }
                for (const m of n.members ?? []) {
                    const p = profiles[m.userId];
                    members.push({
                        userId: m.userId,
                        name: p?.name || p?.email || 'Unknown user',
                        email: p?.email || '',
                        image: p?.image,
                        role: (m.role as SabFileRole) || 'viewer',
                        isOwner: false,
                    });
                }
                if (members.length) next[n.id] = members;
            }
            setMap(next);
        });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sig]);

    return map;
}
