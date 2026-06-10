'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/sabcrm/20ui';
import { LoaderCircle, AlertCircle, CheckCircle2 } from 'lucide-react';

import { WhatsAppIcon } from './custom-sidebar-components';
import { completeWhatsAppEmbeddedSignup } from '@/app/actions/facebook.actions';

// Must match the Graph version used in the server-side token exchange.
const GRAPH_VERSION = 'v24.0';
const FB_SDK_SRC = `https://connect.facebook.net/en_US/sdk.js`;

// Facebook posts the WA_EMBEDDED_SIGNUP session info from these origins.
const FB_MESSAGE_ORIGINS = new Set([
  'https://www.facebook.com',
  'https://web.facebook.com',
  'https://business.facebook.com',
]);

declare global {
  interface Window {
    // The FB JS SDK injects this; we only use a small, dynamically-typed slice.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    FB?: any;
    fbAsyncInit?: () => void;
  }
}

interface WhatsAppEmbeddedSignupProps {
  appId: string;
  configId: string;
  includeCatalog: boolean;
  /** Kept for drop-in compatibility with the old redirect component; unused. */
  state?: string;
  reauthorize?: boolean;
}

type SessionInfo = { wabaId?: string; phoneNumberId?: string };

/**
 * Real WhatsApp Embedded Signup, launched through the Facebook JavaScript SDK.
 *
 * The previous component just linked to a server `dialog/oauth` redirect, which
 * cannot run Embedded Signup — `config_id` / `override_default_response_type`
 * are only honored inside `FB.login()`. That is why the returned token only
 * ever carried `public_profile`. This component loads the SDK, listens for the
 * `WA_EMBEDDED_SIGNUP` message (the exact WABA + phone-number the user picks),
 * runs `FB.login()` with the config, and hands the resulting one-time `code`
 * (plus the captured ids) to the `completeWhatsAppEmbeddedSignup` server action.
 */
export default function WhatsAppEmbeddedSignup({
  appId,
  configId,
  includeCatalog,
  reauthorize = false,
}: WhatsAppEmbeddedSignupProps) {
  const router = useRouter();
  const [sdkReady, setSdkReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  // The session-info event fires independently of the FB.login callback, so we
  // stash the latest payload in a ref and read it when the code comes back.
  const sessionInfoRef = useRef<SessionInfo>({});

  // --- Load + init the FB JS SDK once -------------------------------------
  useEffect(() => {
    if (!appId) return;

    const init = () => {
      if (!window.FB) return;
      window.FB.init({
        appId,
        autoLogAppEvents: true,
        xfbml: false,
        version: GRAPH_VERSION,
      });
      setSdkReady(true);
    };

    if (window.FB) {
      init();
      return;
    }

    window.fbAsyncInit = init;

    // Avoid injecting the script twice (React strict mode / remounts).
    if (!document.getElementById('facebook-jssdk')) {
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = FB_SDK_SRC;
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      script.onerror = () =>
        setError('Could not load Facebook. Please disable any ad/tracker blockers and retry.');
      document.body.appendChild(script);
    }
  }, [appId]);

  // --- Capture the WA_EMBEDDED_SIGNUP session info ------------------------
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!FB_MESSAGE_ORIGINS.has(event.origin)) return;
      let payload: unknown;
      try {
        payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return; // not a JSON ES message
      }
      const data = payload as {
        type?: string;
        event?: string;
        data?: { waba_id?: string; phone_number_id?: string; current_step?: string; error_message?: string };
      };
      if (data?.type !== 'WA_EMBEDDED_SIGNUP') return;

      if (data.event === 'FINISH' || data.event === 'FINISH_ONLY_WABA' || data.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING') {
        sessionInfoRef.current = {
          wabaId: data.data?.waba_id,
          phoneNumberId: data.data?.phone_number_id,
        };
      } else if (data.event === 'CANCEL') {
        console.warn(`[WhatsApp ES] User cancelled at step: ${data.data?.current_step ?? 'unknown'}`);
      } else if (data.event === 'ERROR') {
        setError(data.data?.error_message || 'Facebook reported an error during signup. Please try again.');
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const finalize = useCallback(
    (code: string) => {
      const info = sessionInfoRef.current;
      startTransition(async () => {
        const result = await completeWhatsAppEmbeddedSignup({
          code,
          wabaId: info.wabaId,
          phoneNumberId: info.phoneNumberId,
          includeCatalog,
        });
        if (result.success) {
          setDone(true);
          router.push(result.redirectPath || '/wachat');
          router.refresh();
        } else {
          setError(result.error || 'Onboarding failed. Please try again.');
        }
      });
    },
    [includeCatalog, router],
  );

  const launch = useCallback(() => {
    setError(null);
    sessionInfoRef.current = {};

    if (!window.FB || !sdkReady) {
      setError('Facebook is still loading. Please wait a moment and try again.');
      return;
    }

    window.FB.login(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (response: any) => {
        const code = response?.authResponse?.code;
        if (code) {
          finalize(code);
        } else {
          // No code means the user closed the popup before finishing.
          setError((prev) => prev || 'Signup was closed before completing. Please connect again and finish every step.');
        }
      },
      {
        config_id: configId,
        response_type: 'code',
        override_default_response_type: true,
        ...(reauthorize ? { auth_type: 'reauthorize' } : {}),
        extras: {
          setup: {},
          featureType: '',
          sessionInfoVersion: '3',
        },
      },
    );
  }, [configId, reauthorize, sdkReady, finalize]);

  if (!appId || !configId) {
    return (
      <Button disabled size="lg" className="w-full">
        WhatsApp onboarding not configured
      </Button>
    );
  }

  if (done) {
    return (
      <Button disabled size="lg" className="w-full">
        <CheckCircle2 className="mr-2 h-5 w-5" />
        Connected — redirecting…
      </Button>
    );
  }

  const busy = isPending || !sdkReady;

  return (
    <div className="w-full space-y-2">
      <Button
        size="lg"
        onClick={launch}
        disabled={busy}
        className="w-full bg-[var(--st-text)] hover:bg-[var(--st-text)]/90"
      >
        {busy ? (
          <>
            <LoaderCircle className="mr-2 h-5 w-5 animate-spin" />
            {isPending ? 'Finishing setup…' : 'Loading Facebook…'}
          </>
        ) : (
          <>
            <WhatsAppIcon className="mr-2 h-5 w-5" />
            {reauthorize ? 'Re-authorize WhatsApp' : 'Connect WhatsApp Account'}
          </>
        )}
      </Button>
      {error && (
        <p className="flex items-start gap-1.5 text-sm text-[var(--st-danger,#dc2626)]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
