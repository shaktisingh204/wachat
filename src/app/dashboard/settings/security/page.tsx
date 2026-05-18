'use client';

import {
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSwitch,
  useZoruToast,
} from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useState,
  useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import {
    Key,
  Laptop,
  LoaderCircle,
  Lock,
  LogOut,
  Save,
  Shield,
  } from 'lucide-react';

import { handleChangePassword } from '@/app/actions/user.actions';
import {
    getAccountPreferences,
    getActiveSessions,
    setLoginAlerts as setLoginAlertsAction,
    signOutEverywhere,
    type ActiveSession,
} from '@/app/actions/account.actions';
import { useT } from '@/lib/i18n/client';

const initialState = { message: undefined, error: undefined } as {
    message?: string;
    error?: string;
};

function SaveBtn() {
    const { pending } = useFormStatus();
    const { t } = useT();
    return (
        <ZoruButton type="submit" size="md" disabled={pending}>
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {pending ? t('common.saving') : t('settings.security.updatePassword')}
        </ZoruButton>
    );
}

export default function SecuritySettingsPage() {
    const { t } = useT();
    const [state, formAction] = useActionState(handleChangePassword, initialState);
    const [twoFactor, setTwoFactor] = useState(false);
    const [loginAlerts, setLoginAlerts] = useState(true);
    const [sessions, setSessions] = useState<ActiveSession[]>([]);
    const [revokeAllPending, startRevokeAll] = useTransition();
    const [alertsPending, startAlerts] = useTransition();
    const { toast } = useZoruToast();

    useEffect(() => {
        if (state.message) toast({ title: state.message });
        if (state.error) toast({ title: t('common.error'), description: state.error, variant: 'destructive' });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state]);

    useEffect(() => {
        let cancelled = false;
        Promise.all([getAccountPreferences(), getActiveSessions()])
            .then(([prefs, list]) => {
                if (cancelled) return;
                setLoginAlerts(prefs.loginAlerts);
                setTwoFactor(prefs.twoFactorEnabled);
                setSessions(list);
            })
            .catch(() => {
                /* ignore — page still renders with safe defaults */
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const persistLoginAlerts = (next: boolean) => {
        setLoginAlerts(next);
        startAlerts(async () => {
            try {
                await setLoginAlertsAction(next);
            } catch {
                setLoginAlerts(!next);
                toast({ title: t('settings.security.toast.savePrefFailed'), variant: 'destructive' });
            }
        });
    };

    const persistTwoFactor = (next: boolean) => {
        // Real TOTP wiring lands in a follow-up — flag is read-back from
        // the user record but enabling currently shows a toast so users
        // aren't tricked into thinking 2FA is live.
        if (next) {
            toast({
                title: t('settings.security.toast.twoFactorSoon'),
                description: t('settings.security.toast.twoFactorSoonDesc'),
            });
            return;
        }
        setTwoFactor(false);
    };

    const handleSignOutEverywhere = () => {
        startRevokeAll(async () => {
            try {
                await signOutEverywhere();
                toast({ title: t('settings.security.toast.signedOutEverywhere') });
                window.location.href = '/login';
            } catch (e: any) {
                toast({
                    title: t('settings.security.toast.signOutEverywhereFailed'),
                    description: e?.message ?? t('common.tryAgain'),
                    variant: 'destructive',
                });
            }
        });
    };

    return (
        <div className="flex min-h-full flex-col gap-6">
            <ZoruBreadcrumb>
                <ZoruBreadcrumbList>
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbLink href="/dashboard/settings">{t('settings.overview.title')}</ZoruBreadcrumbLink>
                    </ZoruBreadcrumbItem>
                    <ZoruBreadcrumbSeparator />
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbPage>{t('settings.security.title')}</ZoruBreadcrumbPage>
                    </ZoruBreadcrumbItem>
                </ZoruBreadcrumbList>
            </ZoruBreadcrumb>

            <ZoruPageHeader>
                <ZoruPageHeading>
                    <ZoruPageTitle>{t('settings.security.title')}</ZoruPageTitle>
                    <ZoruPageDescription>
                        {t('settings.security.subtitle')}
                    </ZoruPageDescription>
                </ZoruPageHeading>
            </ZoruPageHeader>

            {/* Password */}
            <ZoruCard className="p-6">
                <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink">
                        <Lock className="h-4 w-4" />
                    </div>
                    <div>
                        <p className="text-sm text-zoru-ink">{t('settings.security.password.title')}</p>
                        <p className="text-xs text-zoru-ink-muted">
                            {t('settings.security.password.hint')}
                        </p>
                    </div>
                </div>
                <form action={formAction} className="grid gap-4 sm:grid-cols-3">
                    <Field label={t('settings.security.password.current')}>
                        <ZoruInput type="password" name="currentPassword" required />
                    </Field>
                    <Field label={t('settings.security.password.new')}>
                        <ZoruInput type="password" name="newPassword" required minLength={12} />
                    </Field>
                    <Field label={t('settings.security.password.confirm')}>
                        <ZoruInput type="password" name="confirmPassword" required minLength={12} />
                    </Field>
                    <div className="sm:col-span-3 flex justify-end">
                        <SaveBtn />
                    </div>
                </form>
            </ZoruCard>

            {/* 2FA */}
            <ZoruCard className="p-6">
                <div className="mb-4 flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink">
                        <Shield className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <p className="text-sm text-zoru-ink">
                                {t('settings.security.twoFactor.title')}
                            </p>
                            <ZoruBadge variant={twoFactor ? 'success' : 'ghost'}>
                                {twoFactor ? t('common.enabled') : t('common.disabled')}
                            </ZoruBadge>
                        </div>
                        <p className="text-xs text-zoru-ink-muted">
                            {t('settings.security.twoFactor.hint')}
                        </p>
                    </div>
                    <ZoruSwitch checked={twoFactor} onCheckedChange={persistTwoFactor} />
                </div>
                <div className="flex items-start justify-between gap-4 rounded-xl border border-zoru-line bg-zoru-surface-2 p-3">
                    <div>
                        <ZoruLabel className="text-[13px]">{t('settings.security.alerts.label')}</ZoruLabel>
                        <p className="mt-0.5 text-xs text-zoru-ink-muted">
                            {t('settings.security.alerts.hint')}
                        </p>
                    </div>
                    <ZoruSwitch
                        checked={loginAlerts}
                        onCheckedChange={persistLoginAlerts}
                        disabled={alertsPending}
                    />
                </div>
            </ZoruCard>

            {/* Active sessions */}
            <ZoruCard className="p-6">
                <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink">
                        <Laptop className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm text-zoru-ink">{t('settings.security.sessions.title')}</p>
                        <p className="text-xs text-zoru-ink-muted">
                            {t('settings.security.sessions.hint')}
                        </p>
                    </div>
                    <ZoruButton
                        variant="ghost"
                        size="sm"
                        onClick={handleSignOutEverywhere}
                        disabled={revokeAllPending}
                    >
                        {revokeAllPending ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : (
                            <LogOut className="h-4 w-4" />
                        )}
                        {t('settings.security.sessions.signOutEverywhere')}
                    </ZoruButton>
                </div>
                <div className="divide-y divide-zoru-line rounded-xl border border-zoru-line">
                    {sessions.length === 0 ? (
                        <SessionRow label={t('settings.security.sessions.current')} device={t('settings.security.sessions.thisBrowser')} location="—" current />
                    ) : (
                        sessions.map((s) => (
                            <SessionRow
                                key={s.id}
                                label={s.current ? t('settings.security.sessions.current') : t('settings.security.sessions.session')}
                                device={s.device}
                                location={s.location ?? '—'}
                                current={s.current}
                            />
                        ))
                    )}
                </div>
            </ZoruCard>

            {/* Recovery */}
            <ZoruCard className="p-6">
                <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink">
                        <Key className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm text-zoru-ink">{t('settings.security.recovery.title')}</p>
                        <p className="text-xs text-zoru-ink-muted">
                            {t('settings.security.recovery.hint')}
                        </p>
                    </div>
                    <ZoruButton variant="outline" size="sm">
                        {t('settings.security.recovery.generate')}
                    </ZoruButton>
                </div>
            </ZoruCard>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <ZoruLabel className="mb-1.5 block text-xs">{label}</ZoruLabel>
            {children}
        </div>
    );
}

function SessionRow({
    label,
    device,
    location,
    current,
}: {
    label: string;
    device: string;
    location: string;
    current?: boolean;
}) {
    const { t } = useT();
    return (
        <div className="flex items-center justify-between px-4 py-3 text-[13px]">
            <div>
                <div className="flex items-center gap-2">
                    <p className="text-zoru-ink">{label}</p>
                    {current && <ZoruBadge variant="success">{t('settings.security.sessions.thisDevice')}</ZoruBadge>}
                </div>
                <p className="mt-0.5 text-xs text-zoru-ink-muted">
                    {device} · {location}
                </p>
            </div>
            {!current && (
                <ZoruButton variant="ghost" size="sm">
                    {t('settings.security.sessions.signOut')}
                </ZoruButton>
            )}
        </div>
    );
}
