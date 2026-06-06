'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Callout,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  EmptyState,
  Field,
  IconButton,
  Input,
  PageDescription,
  PageHeader,
  PageHeading,
  PageTitle,
  Skeleton,
  StatCard,
  useToast,
} from '@/components/sabcrm/20ui';
import { useEffect, useState, useTransition } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  Plus,
  Trash2,
  XCircle,
} from 'lucide-react';

import {
  generateApiKey,
  getApiKeysForUser,
  revokeApiKey,
} from '@/app/actions/api-keys.actions';
import { useT } from '@/lib/i18n/client';
import type { ApiKey } from '@/lib/definitions';

type KeyRow = Omit<ApiKey, 'key'> & { _id: string };

export default function ApiKeysPage() {
  const { t } = useT();
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
  const revokedCount = keys.length - activeCount;

  return (
    <div className="flex min-h-full flex-col gap-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/settings">
              {t('settings.overview.title')}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{t('settings.apiKeys.title')}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <PageHeading>
          <PageTitle>{t('settings.apiKeys.title')}</PageTitle>
          <PageDescription>{t('settings.apiKeys.subtitle')}</PageDescription>
        </PageHeading>
        <CreateKeyDialog onCreated={refresh} />
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label={t('settings.apiKeys.stats.total')}
          value={keys.length}
          icon={KeyRound}
        />
        <StatCard
          label={t('settings.apiKeys.stats.active')}
          value={activeCount}
          icon={CheckCircle2}
        />
        <StatCard
          label={t('settings.apiKeys.stats.revoked')}
          value={revokedCount}
          icon={XCircle}
        />
      </div>

      <Card padding="none">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} height={56} />
            ))}
          </div>
        ) : keys.length === 0 ? (
          <EmptyState
            icon={KeyRound}
            title={t('settings.apiKeys.empty.title')}
            description={t('settings.apiKeys.empty.description')}
            action={<CreateKeyDialog onCreated={refresh} />}
          />
        ) : (
          <ul className="divide-y divide-[var(--st-border)]">
            {keys.map((k) => (
              <KeyRowItem key={k._id} row={k} onRevoked={refresh} />
            ))}
          </ul>
        )}
      </Card>

      <Callout icon={KeyRound} title={t('settings.apiKeys.usingKey.title')}>
        {t('settings.apiKeys.usingKey.descBefore')}
        <code className="mx-1 rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)] px-1.5 py-0.5 text-[var(--st-text)]">
          X-Api-Key
        </code>
        {t('settings.apiKeys.usingKey.descAfter')}
      </Callout>
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
  const { toast } = useToast();

  const handleCreate = () => {
    if (!name.trim()) {
      toast.error(t('settings.apiKeys.toast.nameRequired'));
      return;
    }
    startTransition(async () => {
      const res = await generateApiKey(name.trim());
      if (res.success && res.apiKey) {
        setNewKey(res.apiKey);
        onCreated();
      } else {
        toast.error({ title: t('common.error'), description: res.error });
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
      <DialogTrigger asChild>
        <Button variant="primary" size="sm" iconLeft={Plus}>
          {t('settings.apiKeys.newApiKey')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {newKey
              ? t('settings.apiKeys.dialog.generated.title')
              : t('settings.apiKeys.dialog.generate.title')}
          </DialogTitle>
          <DialogDescription>
            {newKey
              ? t('settings.apiKeys.dialog.generated.description')
              : t('settings.apiKeys.dialog.generate.description')}
          </DialogDescription>
        </DialogHeader>

        {newKey ? (
          <Field label={t('settings.apiKeys.dialog.generated.label')}>
            <Input
              readOnly
              value={newKey}
              suffix={
                <IconButton
                  label={
                    copied
                      ? t('settings.apiKeys.copied')
                      : t('action.copy')
                  }
                  icon={copied ? Check : Copy}
                  size="sm"
                  onClick={copy}
                />
              }
            />
          </Field>
        ) : (
          <Field label={t('settings.apiKeys.dialog.generate.label')}>
            <Input
              placeholder={t('settings.apiKeys.dialog.generate.placeholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
        )}

        <DialogFooter>
          {newKey ? (
            <Button variant="primary" size="sm" onClick={() => setOpen(false)}>
              {t('settings.apiKeys.done')}
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                {t('action.cancel')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreate}
                loading={pending}
              >
                {t('settings.apiKeys.generate')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function KeyRowItem({
  row,
  onRevoked,
}: {
  row: KeyRow;
  onRevoked: () => void;
}) {
  const { t, locale } = useT();
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleRevoke = () => {
    startTransition(async () => {
      const res = await revokeApiKey(row._id.toString());
      if (res.success) {
        toast.success(t('settings.apiKeys.toast.revoked'));
        onRevoked();
      } else {
        toast.error({ title: t('common.error'), description: res.error });
      }
    });
  };

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm text-[var(--st-text)]">{row.name}</p>
          {row.revoked ? (
            <Badge tone="danger" dot>
              {t('settings.apiKeys.status.revoked')}
            </Badge>
          ) : (
            <Badge tone="success" dot>
              {t('settings.apiKeys.status.active')}
            </Badge>
          )}
        </div>
        <p className="mt-1 text-xs text-[var(--st-text-secondary)]">
          {t('settings.apiKeys.row.requests', {
            count: row.requestCount.toLocaleString(locale),
          })}
          {', '}
          {row.lastUsed
            ? t('settings.apiKeys.row.lastUsed', {
                date: formatDate(row.lastUsed, locale),
              })
            : t('settings.apiKeys.row.neverUsed')}
          {', '}
          {t('settings.apiKeys.row.created', {
            date: formatDate(row.createdAt, locale),
          })}
        </p>
      </div>
      {!row.revoked && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              iconLeft={Trash2}
              disabled={pending}
            >
              {t('settings.apiKeys.revoke')}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t('settings.apiKeys.confirmRevoke.title')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t('settings.apiKeys.confirmRevoke.description', {
                  name: row.name,
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('action.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleRevoke}>
                {t('settings.apiKeys.revokeKey')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </li>
  );
}

function formatDate(d: Date | string, locale?: string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
