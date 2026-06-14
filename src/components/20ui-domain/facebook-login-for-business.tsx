'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/sabcrm/20ui';
import { LoaderCircle, AlertCircle, CheckCircle2, Facebook } from 'lucide-react';

import { GRAPH_API_VERSION } from '@/lib/meta/graph-version';
import { completeFacebookPagesSignup } from '@/app/actions/facebook.actions';

// Must match the Graph version used in the server-side token exchange.
const GRAPH_VERSION = GRAPH_API_VERSION;
const FB_SDK_SRC = 'https://connect.facebook.net/en_US/sdk.js';

declare global {
  interface Window {
    // The FB JS SDK injects this; we only use a small, dynamically-typed slice.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    FB?: any;
    fbAsyncInit?: () => void;
  }
}

interface FacebookLoginForBusinessProps {
  appId: string;
  /** A Facebook **Login for Business** configuration id that requests the Pages
   *  permissions (pages_show_list, pages_manage_posts, pages_read_engagement, …). */
  configId: string;
  reauthorize?: boolean;
  /** Optional label override for the connect button. */
  label?: string;
  /** Called after a successful connection (before the redirect fires). */
  onConnected?: () => void;
  /** Where to send the user after a successful connection. */
  redirectTo?: string;
  /** When false, skip the redirect and let the caller drive next steps
   *  (e.g. an onboarding wizard advancing its own stepper). Defaults to true. */
  navigateOnSuccess?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Facebook **Login for Business** launched through the Facebook JavaScript SDK.
 *
 * This is the modern replacement for the legacy `dialog/oauth` server redirect:
 * `config_id` / `override_default_response_type` are only honored inside
 * `FB.login()`, so the redirect flow could only ever return a basic-profile
 * token. This component loads the SDK, runs `FB.login()` with the Pages
 * configuration, and hands the resulting one-time `code` to the
 * `completeFacebookPagesSignup` server action (which exchanges it without a
 * `redirect_uri` and creates a Meta-Suite project per Page).
 */
export default function FacebookLoginForBusiness({
  appId,
  configId,
  reauthorize = false,
  label,
  onConnected,
  redirectTo = '/dashboard/facebook/all-projects',
  navigateOnSuccess = true,
  size = 'lg',
  className,
}: FacebookLoginForBusinessProps) {
  const router = useRouter();
  const [sdkReady, setSdkReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();
  const onConnectedRef = useRef(onConnected);
  onConnectedRef.current = onConnected;

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

  const finalize = useCallback(
    (code: string) => {
      startTransition(async () => {
        try {
          const result = await completeFacebookPagesSignup({ code });
          if (result.success) {
            setDone(true);
            onConnectedRef.current?.();
            if (navigateOnSuccess) {
              router.push(result.redirectPath || redirectTo);
            }
            router.refresh();
          } else {
            setError(result.error || 'Connection failed. Please try again.');
          }
        } catch (e) {
          console.error('[Facebook LFB][client] server action threw:', e);
          setError('Something went wrong finishing setup. Please try again.');
        }
      });
    },
    [router, redirectTo, navigateOnSuccess],
  );

  const launch = useCallback(() => {
    setError(null);

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
          setError(
            (prev) =>
              prev ||
              'Login was closed before Facebook returned an authorization code. Please connect again and finish every step.',
          );
        }
      },
      {
        config_id: configId,
        response_type: 'code',
        override_default_response_type: true,
        ...(reauthorize ? { auth_type: 'reauthorize' } : {}),
      },
    );
  }, [configId, reauthorize, sdkReady, finalize]);

  if (!appId || !configId) {
    return (
      <Button disabled size={size} className={className}>
        Facebook onboarding not configured
      </Button>
    );
  }

  if (done) {
    return (
      <Button disabled size={size} className={className} iconLeft={CheckCircle2}>
        Connected, redirecting…
      </Button>
    );
  }

  const busy = isPending || !sdkReady;

  return (
    <div className="w-full space-y-2">
      <Button
        size={size}
        variant="primary"
        onClick={launch}
        disabled={busy}
        iconLeft={busy ? undefined : Facebook}
        className={className}
      >
        {busy ? (
          <>
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            {isPending ? 'Finishing setup…' : 'Loading Facebook…'}
          </>
        ) : (
          label ?? (reauthorize ? 'Re-authorize Facebook' : 'Connect with Facebook')
        )}
      </Button>
      {error && (
        <p className="flex items-start gap-1.5 text-[12.5px] text-[var(--st-danger,#dc2626)]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
