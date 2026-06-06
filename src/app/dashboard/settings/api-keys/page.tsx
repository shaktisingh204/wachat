'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  Input,
  Label,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Skeleton,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  useEffect,
  useState,
  useTransition } from 'react';
import { Check,
  Copy,
  Key,
  LoaderCircle,
  Plus,
  Trash2 } from 'lucide-react';

import {
    generateApiKey,
    getApiKeysForUser,
    revokeApiKey,
} from '@/app/actions/api-keys.actions';
import { useT } from '@/lib/i18n/client';
import type { ApiKey } from '@/lib/definitions';

type KeyRow = Omit<ApiKey, 'key'> & { _id: string };

export default function ApiKeysPage() {
    const { t, locale } = useT();
    const [keys, setKeys] = useState<KeyRow[]>([]);
    const [loading, setLoading] = useState(true);

    const refresh = async () => {
        setLoading(true);
        try {
            const data = await getApiKeysForUser();
            setKeys(data as unknown as KeyRow[]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refresh();
    }, []);

    const activeCount = keys.filter((k) => !k.revoked).length;

    return (
        <div className="flex min-h-full flex-col gap-6">
            <Breadcrumb>
                <ZoruBreadcrumbList>
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbLink href="/dashboard/settings">{t('settings.overview.title')}</ZoruBreadcrumbLink>
                    </ZoruBreadcrumbItem>
                    <ZoruBreadcrumbSeparator />
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbPage>{t('settings.apiKeys.title')}</ZoruBreadcrumbPage>
                    </ZoruBreadcrumbItem>
                </ZoruBreadcrumbList>
            </Breadcrumb>

            <div className="flex flex-wrap items-center justify-between gap-4">
                <PageHeader>
                    <ZoruPageHeading>
                        <ZoruPageTitle>{t('settings.apiKeys.title')}</ZoruPageTitle>
                        <ZoruPageDescription>
                            {t('settings.apiKeys.subtitle')}
                        </ZoruPageDescription>
                    </ZoruPageHeading>
                </PageHeader>
                <CreateKeyDialog onCreated={refresh} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard label={t('settings.apiKeys.stats.total')} value={keys.length} />
                <StatCard label={t('settings.apiKeys.stats.active')} value={activeCount} tone="green" />
                <StatCard label={t('settings.apiKeys.stats.revoked')} value={keys.length - activeCount} tone="red" />
            </div>

            <Card className="p-0">
                {loading ? (
                    <div className="space-y-2 p-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton key={i} className="h-14 w-full" />
                        ))}
                    </div>
                ) : keys.length === 0 ? (
                    <EmptyState onCreated={refresh} />
                ) : (
                    <ul className="divide-y divide-[var(--st-border)]">
                        {keys.map((k) => (
                            <KeyRowItem key={k._id} row={k} onRevoked={refresh} />
                        ))}
                    </ul>
                )}
            </Card>

            <Card className="p-6">
                <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text)]">
                        <Key className="h-4 w-4" />
                    </div>
                    <div>
                        <p className="text-sm text-[var(--st-text)]">{t('settings.apiKeys.usingKey.title')}</p>
                        <p className="mt-1 text-xs text-[var(--st-text-secondary)]">
                            {t('settings.apiKeys.usingKey.descBefore')}<code className="rounded bg-[var(--st-bg-muted)] px-1">X-Api-Key</code>{t('settings.apiKeys.usingKey.descAfter')}
                        </p>
                    </div>
                </div>
            </Card>
        </div>
    );
}

function CreateKeyDialog({ onCreated }: { onCreated: () => void }) {
    const { t } = useT();
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [newKey, setNewKey] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [pending, startTransition] = useTransition();
    const { toast } = useZoruToast();

    const handleCreate = () => {
        if (!name.trim()) {
            toast({ title: t('settings.apiKeys.toast.nameRequired'), variant: 'destructive' });
            return;
        }
        startTransition(async () => {
            const res = await generateApiKey(name.trim());
            if (res.success && res.apiKey) {
                setNewKey(res.apiKey);
                onCreated();
            } else {
                toast({ title: t('common.error'), description: res.error, variant: 'destructive' });
            }
        });
    };

    const copy = () => {
        if (!newKey) return;
        navigator.clipboard.writeText(newKey).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                if (!next) {
                    setName('');
                    setNewKey(null);
                    setCopied(false);
                }
            }}
        >
            <ZoruDialogTrigger asChild>
                <Button size="sm">
                    <Plus className="h-4 w-4" />
                    {t('settings.apiKeys.newApiKey')}
                </Button>
            </ZoruDialogTrigger>
            <ZoruDialogContent>
                <ZoruDialogHeader>
                    <ZoruDialogTitle>{newKey ? t('settings.apiKeys.dialog.generated.title') : t('settings.apiKeys.dialog.generate.title')}</ZoruDialogTitle>
                    <ZoruDialogDescription>
                        {newKey
                            ? t('settings.apiKeys.dialog.generated.description')
                            : t('settings.apiKeys.dialog.generate.description')}
                    </ZoruDialogDescription>
                </ZoruDialogHeader>

                {newKey ? (
                    <div className="py-2">
                        <Label className="mb-1.5 block text-xs">
                            {t('settings.apiKeys.dialog.generated.label')}
                        </Label>
                        <Input
                            readOnly
                            value={newKey}
                            trailingSlot={
                                <button
                                    type="button"
                                    onClick={copy}
                                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
                                >
                                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                    {copied ? t('settings.apiKeys.copied') : t('action.copy')}
                                </button>
                            }
                        />
                    </div>
                ) : (
                    <div className="py-2">
                        <Label className="mb-1.5 block text-xs">{t('settings.apiKeys.dialog.generate.label')}</Label>
                        <Input
                            placeholder={t('settings.apiKeys.dialog.generate.placeholder')}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                )}

                <ZoruDialogFooter>
                    {newKey ? (
                        <Button size="sm" onClick={() => setOpen(false)}>
                            {t('settings.apiKeys.done')}
                        </Button>
                    ) : (
                        <>
                            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                                {t('action.cancel')}
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleCreate}
                                disabled={pending}
                            >
                                {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                                {t('settings.apiKeys.generate')}
                            </Button>
                        </>
                    )}
                </ZoruDialogFooter>
            </ZoruDialogContent>
        </Dialog>
    );
}

function KeyRowItem({ row, onRevoked }: { row: KeyRow; onRevoked: () => void }) {
    const { t, locale } = useT();
    const [pending, startTransition] = useTransition();
    const { toast } = useZoruToast();

    const handleRevoke = () => {
        startTransition(async () => {
            const res = await revokeApiKey(row._id.toString());
            if (res.success) {
                toast({ title: t('settings.apiKeys.toast.revoked') });
                onRevoked();
            } else {
                toast({ title: t('common.error'), description: res.error, variant: 'destructive' });
            }
        });
    };

    return (
        <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <p className="truncate text-sm text-[var(--st-text)]">{row.name}</p>
                    {row.revoked ? (
                        <Badge variant="danger">{t('settings.apiKeys.status.revoked')}</Badge>
                    ) : (
                        <Badge variant="success">{t('settings.apiKeys.status.active')}</Badge>
                    )}
                </div>
                <p className="mt-1 text-xs text-[var(--st-text-secondary)]">
                    {t('settings.apiKeys.row.requests', { count: row.requestCount.toLocaleString(locale) })} ·
                    {row.lastUsed ? ` ${t('settings.apiKeys.row.lastUsed', { date: formatDate(row.lastUsed, locale) })}` : ` ${t('settings.apiKeys.row.neverUsed')}`} · {t('settings.apiKeys.row.created', { date: formatDate(row.createdAt, locale) })}
                </p>
            </div>
            {!row.revoked && (
                <ZoruAlertDialog>
                    <ZoruAlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" disabled={pending}>
                            <Trash2 className="h-4 w-4" />
                            {t('settings.apiKeys.revoke')}
                        </Button>
                    </ZoruAlertDialogTrigger>
                    <ZoruAlertDialogContent>
                        <ZoruAlertDialogHeader>
                            <ZoruAlertDialogTitle>{t('settings.apiKeys.confirmRevoke.title')}</ZoruAlertDialogTitle>
                            <ZoruAlertDialogDescription>
                                {t('settings.apiKeys.confirmRevoke.description', { name: row.name })}
                            </ZoruAlertDialogDescription>
                        </ZoruAlertDialogHeader>
                        <ZoruAlertDialogFooter>
                            <ZoruAlertDialogCancel>{t('action.cancel')}</ZoruAlertDialogCancel>
                            <ZoruAlertDialogAction
                                onClick={handleRevoke}
                                className="bg-[var(--st-danger)] text-zoru-danger-foreground hover:bg-[var(--st-danger)]/90"
                            >
                                {t('settings.apiKeys.revokeKey')}
                            </ZoruAlertDialogAction>
                        </ZoruAlertDialogFooter>
                    </ZoruAlertDialogContent>
                </ZoruAlertDialog>
            )}
        </li>
    );
}

function EmptyState({ onCreated }: { onCreated: () => void }) {
    const { t } = useT();
    return (
        <div className="p-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
                <Key className="h-5 w-5" />
            </div>
            <p className="text-sm text-[var(--st-text)]">{t('settings.apiKeys.empty.title')}</p>
            <p className="mt-1 text-xs text-[var(--st-text-secondary)]">
                {t('settings.apiKeys.empty.description')}
            </p>
            <div className="mt-4 inline-flex">
                <CreateKeyDialog onCreated={onCreated} />
            </div>
        </div>
    );
}

function StatCard({
    label,
    value,
    tone = 'neutral',
}: {
    label: string;
    value: number;
    tone?: 'neutral' | 'green' | 'red';
}) {
    const { t } = useT();
    return (
        <Card className="p-6">
            <p className="text-xs uppercase tracking-wide text-[var(--st-text-secondary)]">{label}</p>
            <div className="mt-1 flex items-baseline gap-2">
                <p className="text-[26px] leading-none text-[var(--st-text)]">{value}</p>
                {tone === 'green' && value > 0 && <Badge variant="success">{t('settings.apiKeys.inUse')}</Badge>}
                {tone === 'red' && value > 0 && <Badge variant="danger">{t('settings.apiKeys.status.revoked')}</Badge>}
            </div>
        </Card>
    );
}

function formatDate(d: Date | string, locale?: string): string {
    const date = typeof d === 'string' ? new Date(d) : d;
    return date.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
}
