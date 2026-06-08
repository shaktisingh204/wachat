'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { Tag, Globe, Clock, ShieldCheck } from 'lucide-react';

import {
    Button,
    Card,
    CardHeader,
    CardTitle,
    CardBody,
    Field,
    Input,
    Textarea,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Separator,
    useToast,
} from '@/components/sabcrm/20ui';

import {
    createSabmonitorCheck,
    updateSabmonitorCheck,
} from '@/app/actions/sabmonitor.actions';

import type {
    SabmonitorCheckCreateInput,
    SabmonitorCheckDoc,
    SabmonitorCheckKind,
} from '@/lib/rust-client/sabmonitor-checks';

const KIND_OPTIONS: Array<{ value: SabmonitorCheckKind; label: string }> = [
    { value: 'http', label: 'HTTP(S)' },
    { value: 'tcp', label: 'TCP port' },
    { value: 'dns', label: 'DNS' },
    { value: 'ssl', label: 'SSL certificate' },
    { value: 'ping', label: 'Ping (ICMP)' },
    { value: 'synthetic_browser', label: 'Synthetic browser' },
    { value: 'api_transaction', label: 'API transaction' },
];

export function CheckForm({
    initial,
}: {
    initial?: SabmonitorCheckDoc;
}): React.JSX.Element {
    const router = useRouter();
    const { toast } = useToast();
    const [pending, startTransition] = useTransition();
    const [name, setName] = React.useState(initial?.name ?? '');
    const [kind, setKind] = React.useState<SabmonitorCheckKind>(initial?.kind ?? 'http');
    const [url, setUrl] = React.useState(initial?.url ?? '');
    const [host, setHost] = React.useState(initial?.host ?? '');
    const [port, setPort] = React.useState<number | ''>(initial?.port ?? '');
    const [intervalSecs, setIntervalSecs] = React.useState<number>(initial?.intervalSecs ?? 60);
    const [regions, setRegions] = React.useState((initial?.regions ?? []).join(','));
    const [expectedStatus, setExpectedStatus] = React.useState<number | ''>(
        initial?.expectedStatus ?? '',
    );
    const [expectedBodyContains, setExpectedBodyContains] = React.useState(
        initial?.expectedBodyContains ?? '',
    );
    const [sslExpiryWarnDays, setSslExpiryWarnDays] = React.useState<number | ''>(
        initial?.sslExpiryWarnDays ?? '',
    );
    const [headersJson, setHeadersJson] = React.useState(initial?.headersJson ?? '');
    const [bodyJson, setBodyJson] = React.useState(initial?.bodyJson ?? '');

    const onSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
        e.preventDefault();
        const input: SabmonitorCheckCreateInput = {
            name: name.trim(),
            kind,
            intervalSecs: Number(intervalSecs) || 60,
            url: url.trim() || undefined,
            host: host.trim() || undefined,
            port: port === '' ? undefined : Number(port),
            regions: regions
                .split(',')
                .map((r) => r.trim())
                .filter(Boolean),
            expectedStatus: expectedStatus === '' ? undefined : Number(expectedStatus),
            expectedBodyContains: expectedBodyContains.trim() || undefined,
            sslExpiryWarnDays:
                sslExpiryWarnDays === '' ? undefined : Number(sslExpiryWarnDays),
            headersJson: headersJson.trim() || undefined,
            bodyJson: bodyJson.trim() || undefined,
        };
        startTransition(async () => {
            try {
                if (initial?._id) {
                    await updateSabmonitorCheck(initial._id, input);
                    router.push(`/dashboard/sabmonitor/checks/${initial._id}`);
                } else {
                    const res = await createSabmonitorCheck(input);
                    router.push(`/dashboard/sabmonitor/checks/${res.id}`);
                }
            } catch (err) {
                toast.error((err as Error).message);
            }
        });
    };

    const showUrl = kind === 'http' || kind === 'ssl';
    const showHostPort = kind === 'tcp' || kind === 'ping' || kind === 'dns';

    const showValidation = kind === 'http' || kind === 'ssl';

    return (
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <Tag className="h-4 w-4 text-[var(--st-accent)]" aria-hidden="true" />
                        Identity
                    </CardTitle>
                </CardHeader>
                <Separator />
                <CardBody className="grid gap-3 md:grid-cols-2">
                    <Field label="Name" required>
                        <Input value={name} onChange={(e) => setName(e.target.value)} />
                    </Field>
                    <Field label="Kind" id="kind">
                        <Select
                            value={kind}
                            onValueChange={(v) => setKind(v as SabmonitorCheckKind)}
                        >
                            <SelectTrigger id="kind" aria-label="Kind">
                                <SelectValue placeholder="Select a kind" />
                            </SelectTrigger>
                            <SelectContent>
                                {KIND_OPTIONS.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <Globe className="h-4 w-4 text-[var(--st-accent)]" aria-hidden="true" />
                        Target
                    </CardTitle>
                </CardHeader>
                <Separator />
                <CardBody className="flex flex-col gap-3">
                    {showUrl && (
                        <Field label="URL">
                            <Input
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://example.com/health"
                            />
                        </Field>
                    )}

                    {showHostPort && (
                        <div className="grid gap-3 md:grid-cols-2">
                            <Field label="Host">
                                <Input value={host} onChange={(e) => setHost(e.target.value)} />
                            </Field>
                            <Field label="Port">
                                <Input
                                    type="number"
                                    value={port}
                                    onChange={(e) =>
                                        setPort(e.target.value === '' ? '' : Number(e.target.value))
                                    }
                                />
                            </Field>
                        </div>
                    )}

                    {!showUrl && !showHostPort && (
                        <p className="text-[13px] text-[var(--st-text-secondary)]">
                            This monitor kind runs a scripted target — no host or URL is needed
                            here.
                        </p>
                    )}
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-[var(--st-accent)]" aria-hidden="true" />
                        Schedule
                    </CardTitle>
                </CardHeader>
                <Separator />
                <CardBody className="grid gap-3 md:grid-cols-2">
                    <Field label="Interval (seconds)">
                        <Input
                            type="number"
                            value={intervalSecs}
                            onChange={(e) => setIntervalSecs(Number(e.target.value))}
                            min={30}
                        />
                    </Field>
                    <Field label="Regions (comma-separated)">
                        <Input
                            value={regions}
                            onChange={(e) => setRegions(e.target.value)}
                            placeholder="us-east, eu-west"
                        />
                    </Field>
                </CardBody>
            </Card>

            {showValidation && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-sm">
                            <ShieldCheck
                                className="h-4 w-4 text-[var(--st-accent)]"
                                aria-hidden="true"
                            />
                            Validation
                        </CardTitle>
                    </CardHeader>
                    <Separator />
                    <CardBody className="flex flex-col gap-3">
                        {kind === 'http' && (
                            <>
                                <div className="grid gap-3 md:grid-cols-2">
                                    <Field label="Expected status">
                                        <Input
                                            type="number"
                                            value={expectedStatus}
                                            onChange={(e) =>
                                                setExpectedStatus(
                                                    e.target.value === ''
                                                        ? ''
                                                        : Number(e.target.value),
                                                )
                                            }
                                            placeholder="200"
                                        />
                                    </Field>
                                    <Field label="Expected body contains">
                                        <Input
                                            value={expectedBodyContains}
                                            onChange={(e) =>
                                                setExpectedBodyContains(e.target.value)
                                            }
                                        />
                                    </Field>
                                </div>
                                <Field label="Headers (JSON)">
                                    <Textarea
                                        value={headersJson}
                                        onChange={(e) => setHeadersJson(e.target.value)}
                                        rows={3}
                                    />
                                </Field>
                                <Field label="Body (JSON)">
                                    <Textarea
                                        value={bodyJson}
                                        onChange={(e) => setBodyJson(e.target.value)}
                                        rows={3}
                                    />
                                </Field>
                            </>
                        )}

                        {kind === 'ssl' && (
                            <Field label="SSL expiry warn (days)" className="md:max-w-xs">
                                <Input
                                    type="number"
                                    value={sslExpiryWarnDays}
                                    onChange={(e) =>
                                        setSslExpiryWarnDays(
                                            e.target.value === '' ? '' : Number(e.target.value),
                                        )
                                    }
                                    placeholder="14"
                                />
                            </Field>
                        )}
                    </CardBody>
                </Card>
            )}

            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-[var(--st-border)] bg-[var(--st-bg)] py-3">
                <Button type="submit" variant="primary" loading={pending} disabled={pending}>
                    {pending ? 'Saving' : initial ? 'Save monitor' : 'Create monitor'}
                </Button>
            </div>
        </form>
    );
}
