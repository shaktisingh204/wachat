'use client';

import * as React from 'react';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { BellRing, Target, SlidersHorizontal, Send } from 'lucide-react';

import {
    Button,
    Card,
    CardHeader,
    CardTitle,
    CardBody,
    Field,
    Input,
    Textarea,
    Separator,
    useToast,
} from '@/components/sabcrm/20ui';

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
    const { toast } = useToast();
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
            toast.error(`Channels JSON invalid: ${(err as Error).message}`);
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
                toast.error((err as Error).message);
            }
        });
    };

    return (
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <BellRing className="h-4 w-4 text-[var(--st-accent)]" aria-hidden="true" />
                        Identity
                    </CardTitle>
                </CardHeader>
                <Separator />
                <CardBody>
                    <Field label="Name" required>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </Field>
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <Target className="h-4 w-4 text-[var(--st-accent)]" aria-hidden="true" />
                        Scope
                    </CardTitle>
                </CardHeader>
                <Separator />
                <CardBody className="grid gap-3 md:grid-cols-2">
                    <Field label="Check IDs (comma-separated)">
                        <Input
                            value={checkIds}
                            onChange={(e) => setCheckIds(e.target.value)}
                        />
                    </Field>
                    <Field label="Or tag selector">
                        <Input
                            value={tagSelector}
                            onChange={(e) => setTagSelector(e.target.value)}
                            placeholder="prod, public-api"
                        />
                    </Field>
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <SlidersHorizontal
                            className="h-4 w-4 text-[var(--st-accent)]"
                            aria-hidden="true"
                        />
                        Conditions
                    </CardTitle>
                </CardHeader>
                <Separator />
                <CardBody className="grid gap-3 md:grid-cols-2">
                    <Field label="Consecutive down runs">
                        <Input
                            type="number"
                            value={downCount}
                            onChange={(e) =>
                                setDownCount(e.target.value === '' ? '' : Number(e.target.value))
                            }
                        />
                    </Field>
                    <Field label="Slow threshold (ms)">
                        <Input
                            type="number"
                            value={slowMs}
                            onChange={(e) =>
                                setSlowMs(e.target.value === '' ? '' : Number(e.target.value))
                            }
                        />
                    </Field>
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <Send className="h-4 w-4 text-[var(--st-accent)]" aria-hidden="true" />
                        Channels
                    </CardTitle>
                </CardHeader>
                <Separator />
                <CardBody>
                    <Field
                        label="Channels (JSON)"
                        help="One entry per destination — email, Slack, or webhook."
                    >
                        <Textarea
                            value={channels}
                            onChange={(e) => setChannels(e.target.value)}
                            rows={6}
                            placeholder='[{"kind":"email","config":{"to":"oncall@acme.com"}}]'
                        />
                    </Field>
                </CardBody>
            </Card>

            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-[var(--st-border)] bg-[var(--st-bg)] py-3">
                <Button type="submit" variant="primary" loading={pending}>
                    {pending ? 'Saving' : initial ? 'Save policy' : 'Create policy'}
                </Button>
            </div>
        </form>
    );
}
