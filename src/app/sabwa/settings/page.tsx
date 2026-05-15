'use client';

import * as React from 'react';
import { UserCog, RefreshCw, Upload as UploadIcon, Phone, Clock } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';

import { SabFilePickerButton } from '@/components/sabfiles/sab-file-picker';
import { StatusBadge } from '../_components/status-badge';
import { SettingsTabs } from './_components/settings-tabs';
import {
  getProfile,
  updateProfile,
  syncProfileFromDevice,
  type SabwaProfile,
} from '@/app/actions/sabwa.actions';

// Phase 0: the active session id is selected at the layout level (see
// SessionSwitcher). Until a real provider lands, we use a stub id so
// the actions can be exercised end-to-end; the engine ignores it.
const CURRENT_SESSION_ID = 'stub-primary';

export default function ProfileSettingsPage() {
  const [loading, setLoading] = React.useState(true);
  const [pending, startTransition] = React.useTransition();

  const [pushName, setPushName] = React.useState('');
  const [about, setAbout] = React.useState('');
  const [profilePicSabFileId, setProfilePicSabFileId] = React.useState<string | undefined>(undefined);
  const [profilePicUrl, setProfilePicUrl] = React.useState<string | undefined>(undefined);
  const [phoneE164, setPhoneE164] = React.useState<string | undefined>(undefined);
  const [status, setStatus] = React.useState<SabwaProfile['status']>('pending');
  const [lastConnectedAt, setLastConnectedAt] = React.useState<string | undefined>(undefined);

  // Track the original pic id so we know when the "Push to WhatsApp" will
  // change the picture (and trigger the confirm dialog).
  const [initialPicId, setInitialPicId] = React.useState<string | undefined>(undefined);
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
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getProfile(CURRENT_SESSION_ID)
      .then((res) => {
        if (cancelled) return;
        if (res.ok) hydrate(res.profile);
      })
      .catch(() => {
        // Phase 1 stubs throw NOT_IMPLEMENTED — leave the form blank.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hydrate]);

  const onSync = () => {
    startTransition(async () => {
      try {
        const res = await syncProfileFromDevice(CURRENT_SESSION_ID);
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
          sessionId: CURRENT_SESSION_ID,
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

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-secondary p-3">
          <UserCog className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Settings — Profile</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage the public face of your connected WhatsApp account — name, about, and profile picture.
          </p>
        </div>
      </div>
      <SettingsTabs />

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle>Connection</CardTitle>
            <CardDescription>Read-only details about the active SabWa session.</CardDescription>
          </div>
          <StatusBadge status={status ?? 'pending'} />
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Phone number</Label>
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono">{phoneE164 ?? '—'}</span>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Last connected</Label>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{lastConnectedAt ? new Date(lastConnectedAt).toLocaleString() : '—'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Edit values locally, then choose whether to sync from WhatsApp or push your SabNode values up.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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
            <p className="text-xs text-muted-foreground">Up to 25 characters.</p>
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
            <p className="text-xs text-muted-foreground">Up to 139 characters.</p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Profile picture</Label>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="h-20 w-20 rounded-full overflow-hidden bg-secondary flex items-center justify-center text-muted-foreground border">
                {profilePicUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profilePicUrl} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <UserCog className="h-8 w-8" />
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
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
                {profilePicSabFileId && profilePicSabFileId !== initialPicId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setProfilePicSabFileId(initialPicId);
                      // We don't have the previous URL cached — clear it so the
                      // preview matches the saved value.
                      setProfilePicUrl(undefined);
                    }}
                  >
                    Revert
                  </Button>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Square images work best. SabFiles only — external URLs are not accepted.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-end gap-2 pt-6">
          <Button variant="outline" onClick={onSync} disabled={pending || loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${pending ? 'animate-spin' : ''}`} />
            Sync from WhatsApp
          </Button>
          <Button onClick={onPush} disabled={pending || loading}>
            Push to WhatsApp
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={confirmPicOpen} onOpenChange={setConfirmPicOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change profile picture?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace the profile picture shown to everyone you message on WhatsApp.
              Are you sure you want to push this change?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmPicOpen(false);
                doPush();
              }}
            >
              Yes, push it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
