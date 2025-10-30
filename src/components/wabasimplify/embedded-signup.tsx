
'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FacebookIcon } from './custom-sidebar-components';
import { useToast } from '@/hooks/use-toast';
import { handleFacebookSetup } from '@/app/actions';
import { useRouter } from 'next/navigation';
import { LoaderCircle } from 'lucide-react';

declare global {
  interface Window {
    FB: any;
    fbAsyncInit: any;
  }
}

interface EmbeddedSignupProps {
  appId: string;
  configId: string;
  includeCatalog: boolean;
}

export function EmbeddedSignup({ appId, configId, includeCatalog }: EmbeddedSignupProps) {
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (document.getElementById('facebook-jssdk')) {
      setSdkLoaded(true);
      return;
    }

    window.fbAsyncInit = function () {
      window.FB.init({
        appId: appId,
        cookie: true,
        xfbml: true,
        version: 'v20.0',
      });
      setSdkLoaded(true);
    };

    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }, [appId]);

  const onFacebookLogin = () => {
    if (!sdkLoaded) {
      toast({ title: 'SDK Not Loaded', description: 'Facebook SDK is still loading, please wait a moment.', variant: 'destructive' });
      return;
    }
    
    const scopes = ['whatsapp_business_management', 'whatsapp_business_messaging'];
    if (includeCatalog) {
        scopes.push('catalog_management', 'business_management');
    }

    window.FB.login(
      function (response: any) {
        if (response.authResponse && response.authResponse.accessToken) {
          setIsProcessing(true);
          toast({ title: 'Processing...', description: 'Connecting your accounts, please wait.' });
          
          const { accessToken } = response.authResponse;
          const grantedScopes = response.authResponse.grantedScopes || '';
          
          const grantedWabas = grantedScopes
            .split(',')
            .filter((scope: string) => scope.startsWith('whatsapp_business_management'))
            .map((scope: string) => {
                const parts = scope.split(':');
                return parts.length > 1 ? parts[1] : null;
            })
            .filter(Boolean);
          
          if (grantedWabas.length === 0) {
              toast({ title: 'No Account Selected', description: 'You did not select a WhatsApp Business Account to connect.', variant: 'destructive'});
              setIsProcessing(false);
              return;
          }

          handleFacebookSetup(accessToken, grantedWabas, includeCatalog).then(result => {
             if (result.error) {
                toast({ title: 'Setup Failed', description: result.error, variant: 'destructive' });
             }
             if (result.success) {
                toast({ title: 'Setup Complete!', description: `Successfully connected ${result.count} project(s).` });
                router.push('/dashboard');
                router.refresh();
             }
             setIsProcessing(false);
          });

        } else {
          toast({ title: 'Login Cancelled', description: 'You cancelled the login or did not grant permissions.', variant: 'destructive' });
        }
      },
      {
        config_id: configId,
        response_type: 'code',
        scope: scopes.join(','),
        extras: {
            setup: {
                // Prefilled data can go here
            }
        }
      }
    );
  };

  return (
    <Button onClick={onFacebookLogin} disabled={!sdkLoaded || isProcessing} size="lg" className="bg-[#1877F2] hover:bg-[#1877F2]/90">
      {isProcessing ? (
          <LoaderCircle className="mr-2 h-5 w-5 animate-spin" />
      ) : (
          <FacebookIcon className="mr-2 h-5 w-5" />
      )}
      Connect with Facebook
    </Button>
  );
}
