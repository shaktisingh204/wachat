'use client';

import * as React from 'react';

import {
    ZoruTagPicker,
    useZoruToast,
    type ZoruTagPickerProps,
    type ZoruTagPickerTag,
} from '@/components/zoruui';
import {
    createUserTag,
    deleteUserTag,
    updateUserTag,
} from '@/app/actions/user.actions';

/**
 * User-level tag picker. Thin wrapper over `ZoruTagPicker` that wires the
 * `user.tags` server actions so any caller in SabNode can drop this in
 * and get create/edit/delete for free.
 */
export type UserTagPickerProps = Omit<
    ZoruTagPickerProps,
    'onCreate' | 'onUpdate' | 'onDelete' | 'onError'
>;

export type TagPickerTag = ZoruTagPickerTag;

export function TagPicker(props: UserTagPickerProps) {
    const { toast } = useZoruToast();
    const unwrap = async (
        fn: () => Promise<
            { ok: true; tags: ZoruTagPickerTag[] } | { ok: false; error: string }
        >,
    ): Promise<ZoruTagPickerTag[]> => {
        const res = await fn();
        if (!res.ok) throw new Error(res.error);
        return res.tags;
    };

    return (
        <ZoruTagPicker
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
