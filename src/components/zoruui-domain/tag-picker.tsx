'use client';

import * as React from 'react';

import { TagPicker, useToast, type TagPickerProps, type LegacyTagPickerTag } from '@/components/sabcrm/20ui';
import {
    createUserTag,
    deleteUserTag,
    updateUserTag,
} from '@/app/actions/user.actions';

/**
 * User-level tag picker. Thin wrapper over `TagPicker` that wires the
 * `user.tags` server actions so any caller in SabNode can drop this in
 * and get create/edit/delete for free.
 */
export type UserTagPickerProps = Omit<
    TagPickerProps,
    'onCreate' | 'onUpdate' | 'onDelete' | 'onError'
>;

export type TagPickerTag = LegacyTagPickerTag;

export function TagPicker(props: UserTagPickerProps) {
    const { toast } = useToast();
    const unwrap = async (
        fn: () => Promise<
            { ok: true; tags: LegacyTagPickerTag[] } | { ok: false; error: string }
        >,
    ): Promise<LegacyTagPickerTag[]> => {
        const res = await fn();
        if (!res.ok) throw new Error(res.error);
        return res.tags;
    };

    return (
        <TagPicker
            {...props}
            onCreate={(input) => unwrap(() => createUserTag(input))}
            onUpdate={(id, patch) => unwrap(() => updateUserTag(id, patch))}
            onDelete={(id) => unwrap(() => deleteUserTag(id))}
            onError={(message) =>
                toast({ title: 'Tag error', description: message, variant: 'destructive' })
            }
        />
    );
}
