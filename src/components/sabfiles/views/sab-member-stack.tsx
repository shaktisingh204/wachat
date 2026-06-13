'use client';

/**
 * Overlapping avatar stack for a node's collaborators (owner + members),
 * built on the 20ui `AvatarGroup`. Renders nothing when there are no members
 * so empty cells stay clean.
 */
import * as React from 'react';

import { Avatar, AvatarGroup } from '@/components/sabcrm/20ui';

import type { SabFileMember } from './types';

export interface SabMemberStackProps {
    members?: SabFileMember[];
    max?: number;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    className?: string;
}

export function SabMemberStack({
    members,
    max = 4,
    size = 'sm',
    className,
}: SabMemberStackProps): React.JSX.Element | null {
    if (!members || members.length === 0) return null;
    return (
        <AvatarGroup max={max} size={size} shape="round" className={className}>
            {members.map((m) => (
                <Avatar key={m.userId} name={m.name || m.email} src={m.image} shape="round" />
            ))}
        </AvatarGroup>
    );
}
