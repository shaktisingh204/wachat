'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
} from '@/components/zoruui';
import { joinSablensCustomerSession } from '@/app/actions/sablens.actions';
import { MockTransport } from '@/lib/sablens/mock-transport';
import type { LensAnnotation } from '@/lib/sablens/transport';
import type { SablensPublicSessionView as PublicView } from '@/lib/rust-client/sablens-sessions';

import { CustomerAnnotationLayer } from './customer-annotation-layer';

interface Props {
  token: string;
  session: PublicView;
}

export function CustomerLensClient({ token, session }: Props) {
  const [status, setStatus] = useState(session.status);
  const [permissionState, setPermissionState] = useState<
    'idle' | 'requesting' | 'granted' | 'denied'
  >('idle');
  const [annotations, setAnnotations] = useState<LensAnnotation[]>([]);
  const [isPending, startTransition] = useTransition();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const transportRef = useRef<MockTransport | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      transportRef.current?.disconnect();
    };
  }, []);

  async function handleStart() {
    setPermissionState('requesting');
    try {
      // Real flow: getUserMedia + publish over WebRTC peer connection.
      // The MockTransport doesn't actually shuttle the video — the
      // technician sees synthetic frames — but we still ask the browser
      // for permission so the UX is honest.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setPermissionState('granted');

      const t = new MockTransport();
      transportRef.current = t;
      await t.connectAsCustomer(token);
      t.subscribeAnnotations((a) => {
        setAnnotations((prev) =>
          prev.some((p) => p.localId === a.localId) ? prev : [...prev, a],
        );
      });
      t.onSnapshotRequest(() => {
        // TODO: capture a frame off the <video> tag, upload to SabFiles
        // via a customer-facing endpoint, then notify the session.
      });

      startTransition(async () => {
        const res = await joinSablensCustomerSession(token);
        if (res.ok) setStatus(res.data.status);
      });
    } catch (err) {
      setPermissionState('denied');
    }
  }

  const isLive = permissionState === 'granted';

  return (
    <div className="zoruui flex min-h-screen flex-col bg-black text-white">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold">SabLens</span>
          <Badge variant={isLive ? 'default' : 'secondary'}>{status}</Badge>
        </div>
        <span className="text-xs text-white/60">
          {session.customerName ? `Hi, ${session.customerName}` : 'Customer'}
        </span>
      </header>

      {!isLive ? (
        <main className="flex flex-1 items-center justify-center p-6">
          <Card className="w-full max-w-md">
            <ZoruCardHeader>
              <ZoruCardTitle>Start your remote support session</ZoruCardTitle>
              <ZoruCardDescription>
                We'll ask for camera access so your technician can see what
                you see and draw helpful marks on top.
              </ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent className="flex flex-col gap-3">
              {permissionState === 'denied' && (
                <p className="text-sm text-zoru-ink">
                  Camera permission denied. Update your browser settings and
                  try again.
                </p>
              )}
              <Button onClick={handleStart} disabled={permissionState === 'requesting'}>
                {permissionState === 'requesting' ? 'Requesting camera…' : 'Start session'}
              </Button>
            </ZoruCardContent>
          </Card>
        </main>
      ) : (
        <main className="relative flex-1 overflow-hidden">
          <video
            ref={videoRef}
            playsInline
            muted
            className="size-full object-cover"
          />
          <CustomerAnnotationLayer annotations={annotations} />
          {isPending && (
            <div className="absolute right-3 top-3 rounded bg-black/60 px-2 py-1 text-xs">
              Joining…
            </div>
          )}
        </main>
      )}
    </div>
  );
}
