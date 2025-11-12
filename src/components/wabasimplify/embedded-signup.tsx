'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { WhatsAppIcon } from './custom-sidebar-components';

interface WhatsAppEmbeddedSignupProps {
  appId: string;           // Your Meta App ID
  graphVersion?: string;   // e.g., v23.0
  configId: string;        // Your Embedded Signup Configuration ID
}

export function WhatsAppEmbeddedSignup({
  appId,
  graphVersion = 'v23.0',
  configId,
}: WhatsAppEmbeddedSignupProps) {
  useEffect(() => {
    // Load the Facebook SDK
    const script = document.createElement('script');
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    document.body.appendChild(script);

    // Initialize SDK after load
    script.onload = () => {
      if (window.FB) {
        window.FB.init({
          appId: appId,
          autoLogAppEvents: true,
          xfbml: true,
          version: graphVersion,
        });
      }
    };

    // Listen for ES messages
    const handleMessage = (event: MessageEvent) => {
      if (!event.origin.endsWith('facebook.com')) return;
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'WA_EMBEDDED_SIGNUP') {
          console.log('Embedded Signup Event:', data);
          // Handle signup success here
        }
      } catch {
        console.log('Message Event:', event.data);
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [appId, graphVersion]);

  // Launch ES dialog
  const launchWhatsAppSignup = () => {
    if (!window.FB) return;
    window.FB.login((response: any) => {
      if (response.authResponse) {
        console.log('Auth Response:', response.authResponse.code);
        // Send code to your server to exchange for access token
      } else {
        console.log('Login cancelled or failed:', response);
      }
    }, {
      config_id: configId,
      response_type: 'code',
      override_default_response_type: true,
      extras: { setup: {} },
    });
  };

  return (
    <Button
      onClick={launchWhatsAppSignup}
      className="bg-[#25D366] hover:bg-[#25D366]/90 text-white w-full flex items-center justify-center"
      size="lg"
    >
      <WhatsAppIcon className="mr-2 h-5 w-5" />
      Connect with WhatsApp
    </Button>
  );
}
