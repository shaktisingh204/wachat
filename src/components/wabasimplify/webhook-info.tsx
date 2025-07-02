
'use client';

import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Skeleton } from '../ui/skeleton';

interface WebhookInfoProps {
  webhookPath: string;
  verifyToken?: string;
}

function InfoRow({ label, value, isSecret = false }: { label: string, value: string, isSecret?: boolean }) {
    const { toast } = useToast();

    const handleCopy = () => {
        if (!navigator.clipboard) {
          toast({
            title: 'Failed to copy',
            description: 'Clipboard API is not available. Please use a secure (HTTPS) connection.',
            variant: 'destructive',
          });
          return;
        }

        navigator.clipboard.writeText(value).then(() => {
            toast({
                title: 'Copied to clipboard!',
                description: `The ${label.toLowerCase()} has been copied.`,
            });
        }, (err) => {
            console.error('Could not copy text: ', err);
            toast({
                title: 'Failed to copy',
                description: 'Could not copy to clipboard. Check browser permissions.',
                variant: 'destructive',
            });
        });
    };

    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            <div className="flex items-center gap-2">
                <Input
                    readOnly
                    value={value}
                    type={isSecret ? 'password' : 'text'}
                    className="font-mono"
                />
                <Button variant="outline" size="icon" onClick={handleCopy}>
                    <Copy className="h-4 w-4" />
                    <span className="sr-only">Copy {label}</span>
                </Button>
            </div>
        </div>
    )
}

export function WebhookInfo({ webhookPath, verifyToken }: WebhookInfoProps) {
    const [fullUrl, setFullUrl] = useState('');
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
        if (webhookPath.startsWith('/')) {
            setFullUrl(`${window.location.origin}${webhookPath}`);
        } else {
            setFullUrl(webhookPath);
        }
    }, [webhookPath]);

    if (!isClient) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-1/3" />
                    <Skeleton className="h-4 w-2/3" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                       <Skeleton className="h-4 w-1/4" />
                       <Skeleton className="h-10 w-full" />
                    </div>
                    <div className="space-y-2">
                       <Skeleton className="h-4 w-1/4" />
                       <Skeleton className="h-10 w-full" />
                    </div>
                </CardContent>
            </Card>
        )
    }

  return (
    <Card className="card-gradient card-gradient-green">
        <CardHeader>
            <CardTitle>Webhook Details</CardTitle>
            <CardDescription>
                Copy these values into your Meta App configuration.
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <InfoRow label="Callback URL" value={fullUrl} />
            <InfoRow label="Verify Token" value={verifyToken || "Token not set in .env"} isSecret />
        </CardContent>
    </Card>
  );
}
