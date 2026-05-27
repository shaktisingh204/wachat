'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import {
  Button,
  Card,
  Input,
  Label,
  Alert,
  ZoruAlertTitle,
  ZoruAlertDescription,
  Badge,
} from '@/components/zoruui';
import { ScreenShare, ShieldCheck, KeyRound } from 'lucide-react';
import { redeemSabassistAccessToken } from '@/app/actions/sabassist.actions';
import { createAssistTransport, type IAssistTransport } from '@/lib/sabassist/transport';

type Phase = 'collect' | 'connecting' | 'connected' | 'sharing' | 'error';

export default function SabassistCustomerLandingPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [phase, setPhase] = React.useState<Phase>('collect');
  const [pin, setPin] = React.useState('');
  const [mode, setMode] = React.useState<'attended' | 'unattended' | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const transportRef = React.useRef<IAssistTransport | null>(null);
  if (transportRef.current === null) {
    transportRef.current = createAssistTransport();
  }

  const handleAllow = async () => {
    setError(null);
    setPhase('connecting');
    try {
      const redeem = await redeemSabassistAccessToken({
        token,
        pin: pin || undefined,
      });
      if (!redeem.success) {
        setError(humanError(redeem.error));
        setPhase('error');
        return;
      }
      setMode(redeem.mode);
      const t = transportRef.current!;
      await t.connect(token, { pin });
      setPhase('connected');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('error');
    }
  };

  const handleStartShare = async () => {
    setError(null);
    try {
      const t = transportRef.current!;
      // Real implementation: `navigator.mediaDevices.getDisplayMedia(...)`.
      // The mock transport pretends; swap this when WebRTC lands.
      await t.startScreenShare();
      setPhase('sharing');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleStopShare = async () => {
    try {
      const t = transportRef.current!;
      await t.stopScreenShare();
      await t.disconnect();
      setPhase('connected');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-zoru-surface">
      <Card className="p-6 max-w-md w-full space-y-4">
        <div className="flex items-center gap-2">
          <ScreenShare className="h-6 w-6 text-zoru-brand" />
          <div className="font-semibold">SabAssist</div>
          <Badge variant="outline">remote support</Badge>
        </div>

        {phase === 'collect' && (
          <>
            <Alert>
              <ZoruAlertTitle>A technician wants to view your screen</ZoruAlertTitle>
              <ZoruAlertDescription>
                Only allow this if you recognise the support agent who sent
                you this link. You can stop sharing at any time.
              </ZoruAlertDescription>
            </Alert>
            <div>
              <Label htmlFor="pin">One-time PIN (if you were given one)</Label>
              <div className="flex items-center gap-2 mt-1">
                <KeyRound className="h-4 w-4 text-zoru-ink-muted" />
                <Input
                  id="pin"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="123456"
                />
              </div>
            </div>
            <Button className="w-full" onClick={handleAllow}>
              Allow technician to view my screen
            </Button>
          </>
        )}

        {phase === 'connecting' && (
          <div className="text-center text-zoru-ink-muted py-6">
            Verifying access…
          </div>
        )}

        {phase === 'connected' && (
          <>
            <Alert>
              <ZoruAlertTitle>Connected</ZoruAlertTitle>
              <ZoruAlertDescription>
                You are connected as a {mode ?? 'remote'} session. Click below
                to begin sharing your screen with the technician.
              </ZoruAlertDescription>
            </Alert>
            <Button className="w-full" onClick={handleStartShare}>
              <ScreenShare className="h-4 w-4 mr-1" /> Start screen share
            </Button>
          </>
        )}

        {phase === 'sharing' && (
          <>
            <Alert>
              <ZoruAlertTitle>Your screen is being shared</ZoruAlertTitle>
              <ZoruAlertDescription className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                The technician can see this browser tab. Stop sharing whenever
                you like.
              </ZoruAlertDescription>
            </Alert>
            <Button variant="destructive" className="w-full" onClick={handleStopShare}>
              Stop sharing & disconnect
            </Button>
          </>
        )}

        {phase === 'error' && (
          <>
            <Alert variant="destructive">
              <ZoruAlertTitle>Couldn&rsquo;t start the session</ZoruAlertTitle>
              <ZoruAlertDescription>{error}</ZoruAlertDescription>
            </Alert>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setError(null);
                setPhase('collect');
              }}
            >
              Try again
            </Button>
          </>
        )}

        <div className="text-xs text-zoru-ink-muted text-center pt-2">
          Powered by SabAssist · this link is single-use.
        </div>
      </Card>
    </div>
  );
}

function humanError(code: string): string {
  switch (code) {
    case 'not_found':
      return 'This support link is no longer valid.';
    case 'already_used':
      return 'This link has already been used. Ask your technician for a new one.';
    case 'expired':
      return 'This support link has expired.';
    case 'invalid_pin':
      return 'The PIN you entered is incorrect.';
    case 'device_mismatch':
      return 'This link is bound to a different device.';
    case 'session_not_found':
      return 'The session this link points to is no longer available.';
    case 'token_required':
      return 'No token in the link. Open the URL the technician sent.';
    default:
      return code;
  }
}
