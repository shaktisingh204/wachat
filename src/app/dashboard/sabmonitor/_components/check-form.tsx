'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import {
    Button,
    Card,
    CardContent,
    Input,
    Label,
    Textarea,
} from '@/components/sabcrm/20ui/compat';

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
                window.alert((err as Error).message);
            }
        });
    };

    const showUrl = kind === 'http' || kind === 'ssl';
    const showHostPort = kind === 'tcp' || kind === 'ping' || kind === 'dns';

    return (
        <Card className="zoruui">
            <CardContent className="p-4">
                <form className="flex flex-col gap-4" onSubmit={onSubmit}>
                    <div className="grid gap-3 md:grid-cols-2">
                        <div className="flex flex-col gap-1">
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <Label htmlFor="kind">Kind</Label>
                            <select
                                id="kind"
                                value={kind}
                                onChange={(e) =>
                                    setKind(e.target.value as SabmonitorCheckKind)
                                }
                                className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 text-sm text-[var(--st-text)]"
                            >
                                {KIND_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>
                                        {o.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {showUrl && (
                        <div className="flex flex-col gap-1">
                            <Label htmlFor="url">URL</Label>
                            <Input
                                id="url"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://example.com/health"
                            />
                        </div>
                    )}

                    {showHostPort && (
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="flex flex-col gap-1">
                                <Label htmlFor="host">Host</Label>
                                <Input
                                    id="host"
                                    value={host}
                                    onChange={(e) => setHost(e.target.value)}
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <Label htmlFor="port">Port</Label>
                                <Input
                                    id="port"
                                    type="number"
                                    value={port}
                                    onChange={(e) =>
                                        setPort(e.target.value === '' ? '' : Number(e.target.value))
                                    }
                                />
                            </div>
                        </div>
                    )}

                    <div className="grid gap-3 md:grid-cols-2">
                        <div className="flex flex-col gap-1">
                            <Label htmlFor="intervalSecs">Interval (seconds)</Label>
                            <Input
                                id="intervalSecs"
                                type="number"
                                value={intervalSecs}
                                onChange={(e) => setIntervalSecs(Number(e.target.value))}
                                min={30}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <Label htmlFor="regions">Regions (comma-separated)</Label>
                            <Input
                                id="regions"
                                value={regions}
                                onChange={(e) => setRegions(e.target.value)}
                                placeholder="us-east, eu-west"
                            />
                        </div>
                    </div>

                    {kind === 'http' && (
                        <>
                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="flex flex-col gap-1">
                                    <Label htmlFor="expectedStatus">Expected status</Label>
                                    <Input
                                        id="expectedStatus"
                                        type="number"
                                        value={expectedStatus}
                                        onChange={(e) =>
                                            setExpectedStatus(
                                                e.target.value === '' ? '' : Number(e.target.value),
                                            )
                                        }
                                        placeholder="200"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <Label htmlFor="expectedBodyContains">Expected body contains</Label>
                                    <Input
                                        id="expectedBodyContains"
                                        value={expectedBodyContains}
                                        onChange={(e) => setExpectedBodyContains(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="flex flex-col gap-1">
                                <Label htmlFor="headersJson">Headers (JSON)</Label>
                                <Textarea
                                    id="headersJson"
                                    value={headersJson}
                                    onChange={(e) => setHeadersJson(e.target.value)}
                                    rows={3}
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <Label htmlFor="bodyJson">Body (JSON)</Label>
                                <Textarea
                                    id="bodyJson"
                                    value={bodyJson}
                                    onChange={(e) => setBodyJson(e.target.value)}
                                    rows={3}
                                />
                            </div>
                        </>
                    )}

                    {kind === 'ssl' && (
                        <div className="flex flex-col gap-1 md:max-w-xs">
                            <Label htmlFor="sslExpiryWarnDays">SSL expiry warn (days)</Label>
                            <Input
                                id="sslExpiryWarnDays"
                                type="number"
                                value={sslExpiryWarnDays}
                                onChange={(e) =>
                                    setSslExpiryWarnDays(
                                        e.target.value === '' ? '' : Number(e.target.value),
                                    )
                                }
                                placeholder="14"
                            />
                        </div>
                    )}

                    <div className="flex justify-end">
                        <Button type="submit" disabled={pending}>
                            {pending ? 'Saving…' : initial ? 'Save check' : 'Create check'}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
