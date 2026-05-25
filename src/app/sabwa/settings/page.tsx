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
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  EmptyState,
  Input,
  Label,
  Separator,
  Textarea,
  zoruSonnerToast as toast,
} from '@/components/zoruui';
import {
  UserCog,
  RefreshCw,
  Upload as UploadIcon,
  Phone,
  Clock,
  Smartphone,
  Battery,
  MonitorSmartphone,
} from 'lucide-react';

/**
 * /sabwa/settings — Profile sub-page (default route).
 *
 * Visual layer migrated to ZoruUI. Sub-section navigation rendered via
 * `<SettingsTabs>` which is now a segmented ZoruButton-style nav (no
 * tab UI per ZoruUI rules) linking to each settings sub-route.
 */

import * as React from 'react';
import Link from 'next/link';

import { SabFilePickerButton } from '@/components/sabfiles/sab-file-picker';
import { StatusBadge } from '../_components/status-badge';
import { SettingsTabs } from './_components/settings-tabs';
import {
  getProfile,
  updateProfile,
  syncProfileFromDevice,
  type SabwaProfile,
} from '@/app/actions/sabwa.actions';
import { useSabwaSession } from '@/lib/sabwa/session-context';

export default function ProfileSettingsPage() {
  const { current: activeSession } = useSabwaSession();
  const sessionId = activeSession?.id ?? '';
  const [loading, setLoading] = React.useState(true);
  const [pending, startTransition] = React.useTransition();

  const [pushName, setPushName] = React.useState('');
  const [about, setAbout] = React.useState('');
  const [profilePicSabFileId, setProfilePicSabFileId] = React.useState<
    string | undefined
  >(undefined);
  const [profilePicUrl, setProfilePicUrl] = React.useState<string | undefined>(
    undefined,
  );
  const [phoneE164, setPhoneE164] = React.useState<string | undefined>(
    undefined,
  );
  const [status, setStatus] = React.useState<SabwaProfile['status']>('pending');
  const [lastConnectedAt, setLastConnectedAt] = React.useState<
    string | undefined
  >(undefined);
  const [deviceMeta, setDeviceMeta] = React.useState<
    SabwaProfile['deviceMeta'] | undefined
  >(undefined);

  // Track the original pic id so we know when the "Push to WhatsApp" will
  // change the picture (and trigger the confirm dialog).
  const [initialPicId, setInitialPicId] = React.useState<string | undefined>(
    undefined,
  );
  const [confirmPicOpen, setConfirmPicOpen] = React.useState(false);

  const hydrate = React.useCallback((p: SabwaProfile) => {
    setPushName(p.pushName ?? '');
    setAbout(p.about ?? '');
    setProfilePicSabFileId(p.profilePicSabFileId);
    setInitialPicId(p.profilePicSabFileId);
    setProfilePicUrl(p.profilePicUrl);
    setPhoneE164(p.phoneE164);
    setStatus(p.status ?? 'pending');
    setLastConnectedAt(p.lastConnectedAt);
    setDeviceMeta(p.deviceMeta);
  }, []);

  React.useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getProfile(sessionId)
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          hydrate(res.profile);
        } else {
          toast.error(res.error || 'Failed to load profile');
        }
      })
      .catch((e) => {
        if (cancelled) return;
        toast.error((e as Error).message || 'Failed to load profile');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hydrate, sessionId]);

  const onSync = () => {
    startTransition(async () => {
      try {
        const res = await syncProfileFromDevice(sessionId);
        if (res.ok) {
          hydrate(res.profile);
          toast.success('Profile synced from WhatsApp.');
        } else {
          toast.error(res.error || 'Sync failed');
        }
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  };

  const doPush = () => {
    startTransition(async () => {
      try {
        const res = await updateProfile({
          sessionId: sessionId,
          patch: { pushName, about, profilePicSabFileId },
        });
        if (res.ok) {
          setInitialPicId(profilePicSabFileId);
          toast.success('Profile pushed to WhatsApp.');
        } else {
          toast.error(res.error || 'Update failed');
        }
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  };

  const onPush = () => {
    if (profilePicSabFileId && profilePicSabFileId !== initialPicId) {
      setConfirmPicOpen(true);
      return;
    }
    doPush();
  };

  if (!sessionId) {
    return (
      <div className="mx-auto w-full max-w-[1180px] px-6 pt-6 pb-10">
        <EmptyState
          icon={<Smartphone />}
          title="No active WhatsApp account"
          description="Pick a connected account on the SabWa overview to start using this page."
          action={
            <Link href="/sabwa/overview">
              <Button size="md">Open accounts</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-6 px-6 pt-6 pb-10">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/sabwa">SabWa</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Settings</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface text-zoru-ink">
          <UserCog className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-[24px] leading-[1.2] tracking-[-0.015em] text-zoru-ink">
            Settings — Profile
          </h1>
          <p className="mt-1 text-[13px] text-zoru-ink-muted">
            Manage the public face of your connected WhatsApp account — name,
            about, and profile picture.
          </p>
        </div>
      </div>

      <SettingsTabs />

      <Card>
        <ZoruCardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <ZoruCardTitle>Connection</ZoruCardTitle>
            <ZoruCardDescription>
              Read-only details about the active SabWa session.
            </ZoruCardDescription>
          </div>
          <StatusBadge status={status ?? 'pending'} />
        </ZoruCardHeader>
        <ZoruCardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide text-zoru-ink-muted">
              Phone number
            </Label>
            <div className="flex items-center gap-2 text-sm text-zoru-ink">
              <Phone className="h-4 w-4 text-zoru-ink-muted" />
              <span className="font-mono">{phoneE164 ?? '—'}</span>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide text-zoru-ink-muted">
              Last connected
            </Label>
            <div className="flex items-center gap-2 text-sm text-zoru-ink">
              <Clock className="h-4 w-4 text-zoru-ink-muted" />
              <span>
                {lastConnectedAt
                  ? new Date(lastConnectedAt).toLocaleString()
                  : '—'}
              </span>
            </div>
          </div>
          {deviceMeta && (
            <>
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wide text-zoru-ink-muted">
                  Device Platform
                </Label>
                <div className="flex items-center gap-2 text-sm text-zoru-ink">
                  <MonitorSmartphone className="h-4 w-4 text-zoru-ink-muted" />
                  <span>
                    {deviceMeta.platform ?? 'Unknown'}
                    {deviceMeta.appVersion ? ` (v${deviceMeta.appVersion})` : ''}
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wide text-zoru-ink-muted">
                  Battery Level
                </Label>
                <div className="flex items-center gap-2 text-sm text-zoru-ink">
                  <Battery className="h-4 w-4 text-zoru-ink-muted" />
                  <span>
                    {deviceMeta.batteryLevel !== undefined
                      ? `${deviceMeta.batteryLevel}%`
                      : 'Unknown'}
                  </span>
                </div>
              </div>
            </>
          )}
        </ZoruCardContent>
      </Card>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Profile</ZoruCardTitle>
          <ZoruCardDescription>
            Edit values locally, then choose whether to sync from WhatsApp or
            push your SabNode values up.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="push-name">Push name</Label>
            <Input
              id="push-name"
              value={pushName}
              onChange={(e) => setPushName(e.target.value)}
              placeholder="Your name as shown in chats"
              maxLength={25}
              disabled={loading || pending}
            />
            <p className="text-xs text-zoru-ink-muted">
              Up to 25 characters.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="about">About</Label>
            <Textarea
              id="about"
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="Hey there! I am using WhatsApp."
              maxLength={139}
              rows={3}
              disabled={loading || pending}
            />
            <p className="text-xs text-zoru-ink-muted">
              Up to 139 characters.
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Profile picture</Label>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-zoru-line bg-zoru-surface text-zoru-ink-muted">
                {profilePicUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profilePicUrl}
                    alt="Profile"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <UserCog className="h-8 w-8" />
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <SabFilePickerButton
                  accept="image"
                  onPick={(p) => {
                    setProfilePicSabFileId(p.id);
                    setProfilePicUrl(p.url);
                  }}
                >
                  <UploadIcon className="mr-2 h-4 w-4" />
                  {profilePicSabFileId ? 'Change picture' : 'Choose picture'}
                </SabFilePickerButton>
                {profilePicSabFileId &&
                  profilePicSabFileId !== initialPicId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setProfilePicSabFileId(initialPicId);
                        // We don't have the previous URL cached — clear it so
                        // the preview matches the saved value.
                        setProfilePicUrl(undefined);
                      }}
                    >
                      Revert
                    </Button>
                  )}
              </div>
            </div>
            <p className="text-xs text-zoru-ink-muted">
              Square images work best. SabFiles only — external URLs are not
              accepted.
            </p>
          </div>
        </ZoruCardContent>
      </Card>

      <Card>
        <ZoruCardContent className="flex flex-wrap items-center justify-end gap-2 pt-6">
          <Button
            variant="outline"
            onClick={onSync}
            disabled={pending || loading}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${pending ? 'animate-spin' : ''}`}
            />
            Sync from WhatsApp
          </Button>
          <Button onClick={onPush} disabled={pending || loading}>
            Push to WhatsApp
          </Button>
        </ZoruCardContent>
      </Card>

      <ZoruAlertDialog
        open={confirmPicOpen}
        onOpenChange={setConfirmPicOpen}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>
              Change profile picture?
            </ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This will replace the profile picture shown to everyone you
              message on WhatsApp. Are you sure you want to push this change?
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={() => {
                setConfirmPicOpen(false);
                doPush();
              }}
            >
              Yes, push it
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </div>
  );
}
