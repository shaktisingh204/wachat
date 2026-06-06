'use client';

/**
 * Huddle drawer — mocked voice transport. Shows participant chips, a
 * mic-toggle button, and start/join/end controls. The actual audio
 * pipe is out of scope; this is the UI seam for the SabCliq huddles
 * crate to wire up later.
 */
import * as React from 'react';
import { Headphones, Mic, MicOff, PhoneOff, Users } from 'lucide-react';

import { Button, Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, useToast } from '@/components/sabcrm/20ui';

import {
    startTeamHuddle,
    joinTeamHuddle,
    endTeamHuddle,
    getActiveHuddle,
} from '@/app/actions/team-chat.actions';
import type { HuddleView } from '@/app/actions/team-chat.actions.types';

export interface HuddleDrawerProps {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    channelId: string | null;
    meId?: string;
    participantNames: Record<string, string>;
}

export function HuddleDrawer({
    open,
    onOpenChange,
    channelId,
    meId,
    participantNames,
}: HuddleDrawerProps) {
    const { toast } = useToast();
    const [huddle, setHuddle] = React.useState<HuddleView | null>(null);
    const [busy, setBusy] = React.useState(false);
    const [micOn, setMicOn] = React.useState(true);

    const reload = React.useCallback(async () => {
        if (!channelId) {
            setHuddle(null);
            return;
        }
        const active = await getActiveHuddle(channelId);
        setHuddle(active);
    }, [channelId]);

    React.useEffect(() => {
        if (open) void reload();
    }, [open, reload]);

    const onStartOrJoin = async () => {
        if (!channelId) return;
        setBusy(true);
        const res = huddle
            ? await joinTeamHuddle(huddle._id)
            : await startTeamHuddle(channelId);
        setBusy(false);
        if (res.success && res.huddle) {
            setHuddle(res.huddle);
        } else {
            toast({
                title: 'Huddle failed',
                description: res.error,
                variant: 'destructive',
            });
        }
    };

    const onEnd = async () => {
        if (!huddle) return;
        setBusy(true);
        const res = await endTeamHuddle(huddle._id);
        setBusy(false);
        if (res.success) {
            setHuddle(null);
            onOpenChange(false);
        } else {
            toast({
                title: 'Could not end',
                description: res.error,
                variant: 'destructive',
            });
        }
    };

    const meInHuddle = !!huddle && !!meId && huddle.participantIds.includes(meId);

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent className="px-6 pb-6 pt-4">
                <DrawerHeader>
                    <DrawerTitle className="flex items-center gap-2">
                        <Headphones className="h-4 w-4" />
                        Huddle
                    </DrawerTitle>
                </DrawerHeader>

                <div className="mt-4 flex flex-col gap-4">
                    <div className="flex items-center gap-2 text-[12.5px] text-[var(--st-text-secondary)]">
                        <Users className="h-3.5 w-3.5" />
                        {huddle
                            ? `${huddle.participantIds.length} participant${huddle.participantIds.length === 1 ? '' : 's'}`
                            : 'No one is huddling yet.'}
                    </div>

                    {huddle ? (
                        <div className="flex flex-wrap gap-2">
                            {huddle.participantIds.map((id) => (
                                <span
                                    key={id}
                                    className="inline-flex h-7 items-center gap-2 rounded-full border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 text-[11.5px] text-[var(--st-text)]"
                                >
                                    <span
                                        className="h-2 w-2 rounded-full"
                                        style={{ background: 'var(--st-text)' }}
                                    />
                                    {participantNames[id] || id.slice(-6)}
                                </span>
                            ))}
                        </div>
                    ) : null}

                    {meInHuddle ? (
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant={micOn ? 'outline' : 'primary'}
                                size="md"
                                onClick={() => setMicOn((v) => !v)}
                            >
                                {micOn ? (
                                    <Mic className="h-4 w-4" />
                                ) : (
                                    <MicOff className="h-4 w-4" />
                                )}
                                {micOn ? 'Mute' : 'Unmute'}
                            </Button>
                        </div>
                    ) : null}
                </div>

                <DrawerFooter className="mt-6 flex flex-row justify-end gap-2">
                    {huddle && meInHuddle ? (
                        <Button
                            type="button"
                            variant="outline"
                            size="md"
                            onClick={onEnd}
                            disabled={busy}
                        >
                            <PhoneOff className="h-4 w-4" />
                            End huddle
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            size="md"
                            onClick={onStartOrJoin}
                            disabled={busy || !channelId}
                        >
                            <Headphones className="h-4 w-4" />
                            {huddle ? 'Join huddle' : 'Start huddle'}
                        </Button>
                    )}
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}
