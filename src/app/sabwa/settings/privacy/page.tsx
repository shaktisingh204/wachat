'use client';

import { Card, CardBody, CardDescription, CardHeader, CardTitle, Button, Switch, Label, Input, Separator, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Table, TBody, Td, Th, THead, Tr, EmptyState } from '@/components/sabcrm/20ui';
import {
  ShieldCheck,
  KeyRound,
  Lock,
  UserX,
  Plus,
  Loader2,
  Smartphone } from 'lucide-react';
import { toast } from 'sonner';

import * as React from 'react';
import Link from 'next/link';

import { SettingsTabs } from '../_components/settings-tabs';
import {
  getPrivacySettings,
  updatePrivacySettings,
  rotateSessionKey,
  blockContact,
  unblockContact,
  type SabwaPrivacySettings,
  type SabwaVisibility,
} from '@/app/actions/sabwa.actions';
import { useSabwaSession } from '@/lib/sabwa/session-context';

const VISIBILITY_OPTIONS: { value: SabwaVisibility; label: string }[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'contacts', label: 'My contacts' },
  { value: 'nobody', label: 'Nobody' },
];

const TIMER_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'Off' },
  { value: 86400, label: '24 hours' },
  { value: 604800, label: '7 days' },
  { value: 7776000, label: '90 days' },
];

const DEFAULT_SETTINGS: SabwaPrivacySettings = {
  twoFactorEnabled: false,
  readReceipts: true,
  lastSeen: 'contacts',
  groupAddPolicy: 'contacts',
  profilePicVisibility: 'contacts',
  statusVisibility: 'contacts',
  blocked: [],
  disappearingTimer: 0,
};

export default function PrivacySettingsPage() {
  const { current: activeSession } = useSabwaSession();
  const sessionId = activeSession?.id ?? '';
  const [settings, setSettings] = React.useState<SabwaPrivacySettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = React.useState(true);
  const [pending, startTransition] = React.useTransition();

  const [twoFAOpen, setTwoFAOpen] = React.useState(false);
  const [pin, setPin] = React.useState('');
  const [pinConfirm, setPinConfirm] = React.useState('');

  const [blockJid, setBlockJid] = React.useState('');
  const [blockOpen, setBlockOpen] = React.useState(false);

  React.useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getPrivacySettings(sessionId)
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
  }, [sessionId]);

  const save = (patch: Partial<Omit<SabwaPrivacySettings, 'blocked'>> & { twoFactorPin?: string }, label: string) => {
    startTransition(async () => {
      try {
        const res = await updatePrivacySettings({ sessionId, patch });
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
    const prev = settings.blocked;
    const next = prev.filter((b) => b.jid !== jid);
    setSettings((s) => ({ ...s, blocked: next }));
    startTransition(async () => {
      try {
        const res = await unblockContact(sessionId, jid);
        if (res.ok) {
          toast.success('Contact unblocked.');
        } else {
          setSettings((s) => ({ ...s, blocked: prev }));
          toast.error(res.error || 'Unblock failed');
        }
      } catch (e) {
        setSettings((s) => ({ ...s, blocked: prev }));
        toast.error((e as Error).message);
      }
    });
  };

  const onBlockSubmit = () => {
    const v = blockJid.trim();
    if (!v) return;
    const prev = settings.blocked;
    const entry = { jid: v, blockedAt: new Date().toISOString() };
    setSettings((s) => ({ ...s, blocked: [...s.blocked, entry] }));
    setBlockJid('');
    setBlockOpen(false);
    startTransition(async () => {
      try {
        const res = await blockContact(sessionId, v);
        if (res.ok) {
          toast.success('Contact blocked.');
        } else {
          setSettings((s) => ({ ...s, blocked: prev }));
          toast.error(res.error || 'Block failed');
        }
      } catch (e) {
        setSettings((s) => ({ ...s, blocked: prev }));
        toast.error((e as Error).message);
      }
    });
  };

  const onRotate = () => {
    startTransition(async () => {
      try {
        const res = await rotateSessionKey(sessionId);
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
      <CardBody className="flex flex-wrap items-center gap-3 justify-between">
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
      </CardBody>
    </Card>
  );

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
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-[var(--st-bg-muted)] p-3">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings — Privacy &amp; Security</h1>
          <p className="text-sm text-[var(--st-text-secondary)] mt-1">
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
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
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
        </CardBody>
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
        <CardBody>
          {settings.blocked.length === 0 ? (
            <p className="text-sm text-[var(--st-text-secondary)]">No blocked contacts.</p>
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Contact</Th>
                  <Th>Blocked</Th>
                  <Th className="w-24" />
                </Tr>
              </THead>
              <TBody>
                {settings.blocked.map((b) => (
                  <Tr key={b.jid}>
                    <Td className="font-mono text-sm">{b.name || b.jid}</Td>
                    <Td className="text-sm text-[var(--st-text-secondary)]">
                      {b.blockedAt ? new Date(b.blockedAt).toLocaleDateString() : '—'}
                    </Td>
                    <Td className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onUnblock(b.jid)}
                        disabled={pending}
                      >
                        Unblock
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* Read receipts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Read receipts</CardTitle>
          <CardDescription>
            If turned off, you won&apos;t send or receive read receipts. Group chats always send them.
          </CardDescription>
        </CardHeader>
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
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
        </CardBody>
      </Card>

      {/* Visibility selectors */}
      {visibilityRow('Last seen visibility', 'Who can see when you were last online.', 'lastSeen')}
      {visibilityRow('Who can add you to groups', 'Choose who is allowed to add you to WhatsApp groups.', 'groupAddPolicy')}
      {visibilityRow('Profile picture visibility', 'Who can see your profile picture.', 'profilePicVisibility')}
      {visibilityRow('Status visibility', 'Who can see your status updates.', 'statusVisibility')}

      {/* Disappearing messages default timer */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Default message timer</CardTitle>
          <CardDescription>
            Start new chats with disappearing messages turned on.
          </CardDescription>
        </CardHeader>
        <CardBody className="flex flex-wrap items-center gap-3 justify-between">
          <Select
            value={settings.disappearingTimer?.toString() || '0'}
            onValueChange={(v) => setSettings((s) => ({ ...s, disappearingTimer: parseInt(v, 10) }))}
            disabled={loading || pending}
          >
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMER_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value.toString()}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={() => save({ disappearingTimer: settings.disappearingTimer }, 'Default message timer')}
            disabled={pending}
          >
            Save
          </Button>
        </CardBody>
      </Card>

      {/* E2EE disclaimer */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[var(--st-text)]" />
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
        <CardBody>
          <Button variant="outline" onClick={onRotate} disabled={pending}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
            Rotate now
          </Button>
        </CardBody>
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
            <Button onClick={onBlockSubmit} disabled={pending}>
              Block
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
