'use client';

import * as React from 'react';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button, Card, CardContent, Input, Label, Textarea } from '@/components/zoruui';

import {
    createSabmonitorAlertPolicy,
    updateSabmonitorAlertPolicy,
} from '@/app/actions/sabmonitor.actions';

import type {
    SabmonitorAlertPolicyCreateInput,
    SabmonitorAlertPolicyDoc,
} from '@/lib/rust-client/sabmonitor-alert-policies';

export function AlertPolicyForm({
    initial,
}: {
    initial?: SabmonitorAlertPolicyDoc;
}): React.JSX.Element {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [name, setName] = React.useState(initial?.name ?? '');
    const [tagSelector, setTagSelector] = React.useState(initial?.tagSelector ?? '');
    const [checkIds, setCheckIds] = React.useState((initial?.checkIds ?? []).join(','));
    const [downCount, setDownCount] = React.useState<number | ''>(
        initial?.conditions?.downCount ?? 2,
    );
    const [slowMs, setSlowMs] = React.useState<number | ''>(
        initial?.conditions?.slowMs ?? '',
    );
    const [channels, setChannels] = React.useState(
        JSON.stringify(initial?.channels ?? [], null, 2),
    );

    const onSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
        e.preventDefault();
        let parsedChannels: SabmonitorAlertPolicyCreateInput['channels'] = [];
        try {
            parsedChannels = channels.trim() ? JSON.parse(channels) : [];
        } catch (err) {
            window.alert(`Channels JSON invalid: ${(err as Error).message}`);
            return;
        }
        const input: SabmonitorAlertPolicyCreateInput = {
            name: name.trim(),
            tagSelector: tagSelector.trim() || undefined,
            checkIds: checkIds
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            conditions: {
                downCount: downCount === '' ? undefined : Number(downCount),
                slowMs: slowMs === '' ? undefined : Number(slowMs),
            },
            channels: parsedChannels,
        };
        startTransition(async () => {
            try {
                if (initial?._id) {
                    await updateSabmonitorAlertPolicy(initial._id, input);
                    router.push('/dashboard/sabmonitor/alert-policies');
                } else {
                    await createSabmonitorAlertPolicy(input);
                    router.push('/dashboard/sabmonitor/alert-policies');
                }
            } catch (err) {
                window.alert((err as Error).message);
            }
        });
    };

    return (
        <Card className="zoruui">
            <CardContent className="p-4">
                <form className="flex flex-col gap-4" onSubmit={onSubmit}>
                    <div className="flex flex-col gap-1">
                        <Label htmlFor="name">Name</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                        <div className="flex flex-col gap-1">
                            <Label htmlFor="checkIds">Check IDs (comma-separated)</Label>
                            <Input
                                id="checkIds"
                                value={checkIds}
                                onChange={(e) => setCheckIds(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <Label htmlFor="tagSelector">Or tag selector</Label>
                            <Input
                                id="tagSelector"
                                value={tagSelector}
                                onChange={(e) => setTagSelector(e.target.value)}
                                placeholder="prod, public-api"
                            />
                        </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                        <div className="flex flex-col gap-1">
                            <Label htmlFor="downCount">Consecutive down runs</Label>
                            <Input
                                id="downCount"
                                type="number"
                                value={downCount}
                                onChange={(e) =>
                                    setDownCount(e.target.value === '' ? '' : Number(e.target.value))
                                }
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <Label htmlFor="slowMs">Slow threshold (ms)</Label>
                            <Input
                                id="slowMs"
                                type="number"
                                value={slowMs}
                                onChange={(e) =>
                                    setSlowMs(e.target.value === '' ? '' : Number(e.target.value))
                                }
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <Label htmlFor="channels">Channels (JSON)</Label>
                        <Textarea
                            id="channels"
                            value={channels}
                            onChange={(e) => setChannels(e.target.value)}
                            rows={6}
                            placeholder='[{"kind":"email","config":{"to":"oncall@acme.com"}}]'
                        />
                    </div>
                    <div className="flex justify-end">
                        <Button type="submit" disabled={pending}>
                            {pending ? 'Saving…' : initial ? 'Save policy' : 'Create policy'}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
