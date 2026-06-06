'use client';

import {
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  Button,
  Input,
  Label,
  Skeleton,
  Badge,
  Select,
} from '@/components/sabcrm/20ui/compat';
import {
  useToast } from '@/hooks/use-toast';
import { Copy, CheckCircle, AlertTriangle, RefreshCw, LoaderCircle } from 'lucide-react';
import { useEffect,
  useState,
  useTransition } from 'react';
import { getWebhookSubscriptionStatus } from '@/app/actions/whatsapp.actions';
import { getProjectById } from '@/app/actions/index.ts';

import { cn } from '@/lib/utils';
import { SubscribeProjectButton } from './subscribe-project-button';

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

function WebhookStatus() {
    const [status, setStatus] = useState<{ isActive: boolean; error?: string } | null>(null);
    const [isLoading, startTransition] = useTransition();
    const [projectId, setProjectId] = useState<string | null>(null);

    const checkStatus = async () => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        if (!storedProjectId) {
            setStatus({ isActive: false, error: "No project selected."});
            return;
        }
        setProjectId(storedProjectId);
        
        startTransition(async () => {
            const project = await getProjectById(storedProjectId);
            if(project?.wabaId && project.accessToken) {
                const statusResult = await getWebhookSubscriptionStatus(project.wabaId, project.accessToken);
                setStatus(statusResult);
            } else {
                setStatus({ isActive: false, error: "Project WABA ID or Access Token not configured." });
            }
        });
    }

    useEffect(() => {
        checkStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <Card>
            <ZoruCardHeader className="flex flex-row items-center justify-between">
                <div>
                    <ZoruCardTitle>Live Status</ZoruCardTitle>
                    <ZoruCardDescription>Real-time status of your webhook subscription from Meta.</ZoruCardDescription>
                </div>
                <Button variant="outline" size="icon" onClick={checkStatus} disabled={isLoading}>
                   {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <RefreshCw className="h-4 w-4" />}
                </Button>
            </ZoruCardHeader>
            <ZoruCardContent>
                {isLoading ? (
                    <Skeleton className="h-10 w-full" />
                ) : status && projectId ? (
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                            {status.isActive ? (
                                <CheckCircle className="h-5 w-5 text-zoru-ink" />
                            ) : (
                                <AlertTriangle className="h-5 w-5 text-zoru-ink" />
                            )}
                            <div className="flex flex-col">
                                <span className={cn("font-semibold", status.isActive ? 'text-zoru-ink' : 'text-zoru-ink')}>
                                    {status.isActive ? 'Active' : 'Inactive'}
                                </span>
                                {status.error && <span className="text-xs text-zoru-ink-muted font-mono">{status.error}</span>}
                            </div>
                        </div>
                        <SubscribeProjectButton projectId={projectId} isActive={status.isActive} />
                    </div>
                ) : (
                    <p className="text-zoru-ink-muted text-sm">Could not determine status. Select a project.</p>
                )}
            </ZoruCardContent>
        </Card>
    );
}

export function WebhookInfo({ webhookPath, verifyToken }: WebhookInfoProps) {
    const [fullUrl, setFullUrl] = useState('');
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        if (isClient) {
            if (webhookPath.startsWith('/')) {
                setFullUrl(`${window.location.origin}${webhookPath}`);
            } else {
                setFullUrl(webhookPath);
            }
        }
    }, [isClient, webhookPath]);

    if (!isClient) {
        return (
            <Card>
                <ZoruCardHeader>
                    <Skeleton className="h-6 w-1/3" />
                    <Skeleton className="h-4 w-2/3" />
                </ZoruCardHeader>
                <ZoruCardContent className="space-y-4">
                    <div className="space-y-2">
                       <Skeleton className="h-4 w-1/4" />
                       <Skeleton className="h-10 w-full" />
                    </div>
                    <div className="space-y-2">
                       <Skeleton className="h-4 w-1/4" />
                       <Skeleton className="h-10 w-full" />
                    </div>
                </ZoruCardContent>
            </Card>
        )
    }

  return (
    <div className="grid lg:grid-cols-2 gap-8">
        <Card className="card-gradient card-gradient-green">
            <ZoruCardHeader>
                <ZoruCardTitle>Webhook Configuration</ZoruCardTitle>
                <ZoruCardDescription>
                    Copy these values into your Meta App configuration.
                </ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-4">
                <InfoRow label="Callback URL" value={fullUrl} />
                <InfoRow label="Verify Token" value={verifyToken || "Token not set in .env"} isSecret />
            </ZoruCardContent>
        </Card>
        <WebhookStatus />
    </div>
  );
}

