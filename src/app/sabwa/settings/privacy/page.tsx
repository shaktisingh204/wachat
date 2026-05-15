'use client';

import * as React from 'react';
import { ShieldCheck, KeyRound, Lock, UserX, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { SettingsTabs } from '../_components/settings-tabs';
import {
  getPrivacySettings,
  updatePrivacySettings,
  rotateSessionKey,
  type SabwaPrivacySettings,
  type SabwaVisibility,
} from '@/app/actions/sabwa.actions';

const CURRENT_SESSION_ID = 'stub-primary';

const VISIBILITY_OPTIONS: { value: SabwaVisibility; label: string }[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'contacts', label: 'My contacts' },
  { value: 'nobody', label: 'Nobody' },
];

const DEFAULT_SETTINGS: SabwaPrivacySettings = {
  twoFactorEnabled: false,
  readReceipts: true,
  lastSeen: 'contacts',
  groupAddPolicy: 'contacts',
  profilePicVisibility: 'contacts',
  statusVisibility: 'contacts',
  blocked: [],
};

export default function PrivacySettingsPage() {
  const [settings, setSettings] = React.useState<SabwaPrivacySettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = React.useState(true);
  const [pending, startTransition] = React.useTransition();

  const [twoFAOpen, setTwoFAOpen] = React.useState(false);
  const [pin, setPin] = React.useState('');
  const [pinConfirm, setPinConfirm] = React.useState('');

  const [blockJid, setBlockJid] = React.useState('');
  const [blockOpen, setBlockOpen] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getPrivacySettings(CURRENT_SESSION_ID)
      .then((res) => {
        if (cancelled) return;
        if (res.ok) setSettings(res.settings);
      })
      .catch(() => {
        /* Phase 1 stub */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = (patch: Partial<Omit<SabwaPrivacySettings, 'blocked'>> & { twoFactorPin?: string }, label: string) => {
    startTransition(async () => {
      try {
        const res = await updatePrivacySettings({ sessionId: CURRENT_SESSION_ID, patch });
        if (res.ok) {
          toast.success(`${label} saved.`);
        } else {
          toast.error(res.error || 'Save failed');
        }
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  };

  const onTwoFASubmit = () => {
    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      toast.error('PIN must be 6 digits.');
      return;
    }
    if (pin !== pinConfirm) {
      toast.error('PINs do not match.');
      return;
    }
    setSettings((s) => ({ ...s, twoFactorEnabled: true }));
    save({ twoFactorEnabled: true, twoFactorPin: pin }, 'Two-factor authentication');
    setTwoFAOpen(false);
    setPin('');
    setPinConfirm('');
  };

  const onDisable2FA = () => {
    setSettings((s) => ({ ...s, twoFactorEnabled: false }));
    save({ twoFactorEnabled: false }, 'Two-factor authentication');
  };

  const onUnblock = (jid: string) => {
    const next = settings.blocked.filter((b) => b.jid !== jid);
    setSettings((s) => ({ ...s, blocked: next }));
    toast.success('Contact unblocked.');
    // Persistence for blocked list goes through dedicated block/unblock
    // actions; for now the local-state update keeps the UI honest until
    // engine wiring lands.
  };

  const onBlockSubmit = () => {
    const v = blockJid.trim();
    if (!v) return;
    setSettings((s) => ({
      ...s,
      blocked: [...s.blocked, { jid: v, blockedAt: new Date().toISOString() }],
    }));
    toast.success('Contact blocked.');
    setBlockJid('');
    setBlockOpen(false);
  };

  const onRotate = () => {
    startTransition(async () => {
      try {
        const res = await rotateSessionKey(CURRENT_SESSION_ID);
        if (res.ok) {
          toast.success('Session encryption key rotated.');
        } else {
          toast.error(res.error || 'Rotation failed');
        }
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  };

  const visibilityRow = (
    title: string,
    description: string,
    field: keyof Pick<
      SabwaPrivacySettings,
      'lastSeen' | 'groupAddPolicy' | 'profilePicVisibility' | 'statusVisibility'
    >,
  ) => (
    <Card key={field}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3 justify-between">
        <Select
          value={settings[field]}
          onValueChange={(v) => setSettings((s) => ({ ...s, [field]: v as SabwaVisibility }))}
          disabled={loading || pending}
        >
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VISIBILITY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => save({ [field]: settings[field] } as Partial<SabwaPrivacySettings>, title)} disabled={pending}>
          Save
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-secondary p-3">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings — Privacy &amp; Security</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Lock down who can see what, who can reach you, and how your session is encrypted.
          </p>
        </div>
      </div>
      <SettingsTabs />

      {/* Two-factor authentication */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Two-factor authentication
          </CardTitle>
          <CardDescription>
            Require a 6-digit PIN when registering this phone number on a new device.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Switch
              checked={settings.twoFactorEnabled}
              onCheckedChange={(checked) => {
                if (checked) {
                  setTwoFAOpen(true);
                } else {
                  onDisable2FA();
                }
              }}
              disabled={loading || pending}
              aria-label="Toggle two-factor authentication"
            />
            <Label className="text-sm">
              {settings.twoFactorEnabled ? 'Enabled — PIN required for re-registration.' : 'Disabled'}
            </Label>
          </div>
          {settings.twoFactorEnabled && (
            <Button variant="outline" size="sm" onClick={() => setTwoFAOpen(true)} disabled={pending}>
              Change PIN
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Blocked contacts */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <UserX className="h-4 w-4" />
              Blocked contacts
            </CardTitle>
            <CardDescription>
              Numbers in this list cannot message or call you on WhatsApp.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setBlockOpen(true)} disabled={pending}>
            <Plus className="mr-2 h-4 w-4" />
            Block contact
          </Button>
        </CardHeader>
        <CardContent>
          {settings.blocked.length === 0 ? (
            <p className="text-sm text-muted-foreground">No blocked contacts.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Blocked</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {settings.blocked.map((b) => (
                  <TableRow key={b.jid}>
                    <TableCell className="font-mono text-sm">{b.name || b.jid}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {b.blockedAt ? new Date(b.blockedAt).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => onUnblock(b.jid)}>
                        Unblock
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Read receipts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Read receipts</CardTitle>
          <CardDescription>
            If turned off, you won&apos;t send or receive read receipts. Group chats always send them.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Switch
              checked={settings.readReceipts}
              onCheckedChange={(checked) =>
                setSettings((s) => ({ ...s, readReceipts: checked }))
              }
              disabled={loading || pending}
              aria-label="Toggle read receipts"
            />
            <Label className="text-sm">Send read receipts</Label>
          </div>
          <Button size="sm" onClick={() => save({ readReceipts: settings.readReceipts }, 'Read receipts')} disabled={pending}>
            Save
          </Button>
        </CardContent>
      </Card>

      {/* Visibility selectors */}
      {visibilityRow('Last seen visibility', 'Who can see when you were last online.', 'lastSeen')}
      {visibilityRow('Who can add you to groups', 'Choose who is allowed to add you to WhatsApp groups.', 'groupAddPolicy')}
      {visibilityRow('Profile picture visibility', 'Who can see your profile picture.', 'profilePicVisibility')}
      {visibilityRow('Status visibility', 'Who can see your status updates.', 'statusVisibility')}

      {/* E2EE disclaimer */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-green-600" />
            End-to-end encryption
          </CardTitle>
          <CardDescription>
            Messages, calls, and media you send to other WhatsApp users are protected with the Signal protocol —
            no one outside the chat, not even SabNode or WhatsApp, can read or listen to them. SabNode stores a
            local cache of decrypted messages so the SabWa inbox works; that cache is encrypted at rest with
            your session key.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Session key rotation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Session encryption key
          </CardTitle>
          <CardDescription>
            Rotate the SabNode-side key that wraps this session&apos;s auth state. Existing chats stay intact;
            cached data is re-encrypted in the background.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={onRotate} disabled={pending}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
            Rotate now
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* 2FA setup dialog */}
      <Dialog open={twoFAOpen} onOpenChange={setTwoFAOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set up two-factor PIN</DialogTitle>
            <DialogDescription>
              Choose a 6-digit PIN. You&apos;ll need it whenever you re-register this number on a new device.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pin">6-digit PIN</Label>
              <Input
                id="pin"
                inputMode="numeric"
                maxLength={6}
                pattern="\d{6}"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pin-confirm">Confirm PIN</Label>
              <Input
                id="pin-confirm"
                inputMode="numeric"
                maxLength={6}
                pattern="\d{6}"
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ''))}
                autoComplete="off"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTwoFAOpen(false)}>
              Cancel
            </Button>
            <Button onClick={onTwoFASubmit} disabled={pending}>
              Save PIN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block contact dialog (simple JID input — proper contact picker is a
          shared component slated for the broader Contacts work). */}
      <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block a contact</DialogTitle>
            <DialogDescription>
              Enter the phone number (E.164) of the contact you want to block.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="block-jid">Phone number</Label>
            <Input
              id="block-jid"
              value={blockJid}
              onChange={(e) => setBlockJid(e.target.value)}
              placeholder="+919876543210"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBlockOpen(false)}>
              Cancel
            </Button>
            <Button onClick={onBlockSubmit}>Block</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
