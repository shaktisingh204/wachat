

'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FacebookIcon } from './custom-sidebar-components';
import { useToast } from '@/hooks/use-toast';
import { handleConnectNewFacebookPage } from '@/app/actions/facebook.actions';
import { useRouter } from 'next/navigation';
import { LoaderCircle } from 'lucide-react';

declare global {
  interface Window {
    FB: any;
    fbAsyncInit: any;
  }
}

interface FacebookEmbeddedSignupProps {
  appId: string;
  configId: string;
  onSuccess: () => void;
}

export function FacebookEmbeddedSignup({ appId, configId, onSuccess }: FacebookEmbeddedSignupProps) {
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (document.getElementById('facebook-jssdk')) {
      if (window.FB) setSdkLoaded(true);
      return;
    }

    window.fbAsyncInit = function () {
      window.FB.init({
        appId: appId,
        cookie: true,
        xfbml: true,
        version: 'v22.0',
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
    
    const scopes = 'ads_management,pages_show_list,pages_read_engagement,business_management,pages_manage_posts,read_insights,pages_manage_engagement';

    window.FB.login(
      function (response: any) {
        if (response.authResponse) {
            setIsProcessing(true);
            toast({ title: 'Processing...', description: 'Connecting your accounts, please wait.' });
            
            const accessToken = response.authResponse.accessToken;

            window.FB.api('/me/adaccounts?fields=account_id', async function(adAccountsResponse: any) {
                if (!adAccountsResponse || adAccountsResponse.error || !adAccountsResponse.data || adAccountsResponse.data.length === 0) {
                    toast({ title: 'Ad Account Not Found', description: 'Could not find an Ad Account. Please ensure one is associated with your business.', variant: 'destructive' });
                    setIsProcessing(false);
                    return;
                }
                const adAccountId = adAccountsResponse.data[0].id;
                
                window.FB.api('/me/accounts?fields=id,name', async function(pagesResponse: any) {
                    if (!pagesResponse || pagesResponse.error || !pagesResponse.data || pagesResponse.data.length === 0) {
                        toast({ title: 'Facebook Page Not Found', description: 'Could not find a Facebook Page. Please ensure one is associated with your business.', variant: 'destructive' });
                        setIsProcessing(false);
                        return;
                    }
                    const facebookPageId = pagesResponse.data[0].id;
                    const pageName = pagesResponse.data[0].name;

                    const result = await handleConnectNewFacebookPage({ adAccountId, facebookPageId, accessToken, pageName });
                    
                    if (result.error) {
                        toast({ title: 'Setup Failed', description: result.error, variant: 'destructive' });
                    } else if (result.success) {
                        toast({ title: 'Setup Complete!', description: `Successfully connected your page.` });
                        onSuccess();
                    }
                    setIsProcessing(false);
                });
            });

        } else {
          toast({ title: 'Login Cancelled', description: 'You cancelled the login or did not grant permissions.', variant: 'destructive' });
        }
      },
      {
        config_id: configId,
        scope: scopes,
      }
    );
  };

  return (
    <Button onClick={onFacebookLogin} disabled={!sdkLoaded || isProcessing} size="lg" className="bg-[#1877F2] hover:bg-[#1877F2]/90 w-full">
      {isProcessing ? (
          <LoaderCircle className="mr-2 h-5 w-5 animate-spin" />
      ) : (
          <FacebookIcon className="mr-2 h-5 w-5" />
      )}
      Connect with Facebook
    </Button>
  );
}

    
