'use client';

/**
 * WebhookInfo (wachat-local, ZoruUI).
 *
 * Replaces @/components/wabasimplify/webhook-info. Renders the callback
 * URL + verify token (read-only, copyable) and a live status card that
 * polls Meta. Server actions and copy-to-clipboard behaviour preserved.
 */

import * as React from 'react';
import { useEffect, useState, useTransition } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Copy,
  Loader2,
  RefreshCw,
} from 'lucide-react';

import { getWebhookSubscriptionStatus } from '@/app/actions/whatsapp.actions';
import { getProjectById } from '@/app/actions/index.ts';

import {
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruSkeleton,
  cn,
  useZoruToast,
} from '@/components/zoruui';

import { SubscribeProjectButton } from './subscribe-project-button';

interface WebhookInfoProps {
  webhookPath: string;
  verifyToken?: string;
}

function InfoRow({
  label,
  value,
  isSecret = false,
}: {
  label: string;
  value: string;
  isSecret?: boolean;
}) {
  const { toast } = useZoruToast();

  const handleCopy = () => {
    if (!navigator.clipboard) {
      toast({
        title: 'Failed to copy',
        description:
          'Clipboard API is not available. Please use a secure (HTTPS) connection.',
        variant: 'destructive',
      });
      return;
    }

    navigator.clipboard.writeText(value).then(
      () => {
        toast({
          title: 'Copied to clipboard!',
          description: `The ${label.toLowerCase()} has been copied.`,
        });
      },
      (err) => {
        console.error('Could not copy text: ', err);
        toast({
          title: 'Failed to copy',
          description:
            'Could not copy to clipboard. Check browser permissions.',
          variant: 'destructive',
        });
      },
    );
  };

  return (
    <div className="flex flex-col gap-1.5">
      <ZoruLabel>{label}</ZoruLabel>
      <div className="flex items-center gap-2">
        <ZoruInput
          readOnly
          value={value}
          type={isSecret ? 'password' : 'text'}
          className="font-mono"
        />
        <ZoruButton
          variant="outline"
          size="icon"
          onClick={handleCopy}
          aria-label={`Copy ${label}`}
        >
          <Copy />
        </ZoruButton>
      </div>
    </div>
  );
}

function WebhookStatus() {
  const [status, setStatus] = useState<{
    isActive: boolean;
    error?: string;
  } | null>(null);
  const [isLoading, startTransition] = useTransition();
  const [projectId, setProjectId] = useState<string | null>(null);

  const checkStatus = async () => {
    const storedProjectId = localStorage.getItem('activeProjectId');
    if (!storedProjectId) {
      setStatus({ isActive: false, error: 'No project selected.' });
      return;
    }
    setProjectId(storedProjectId);

    startTransition(async () => {
      const project = await getProjectById(storedProjectId);
      if (project?.wabaId && project.accessToken) {
        const statusResult = await getWebhookSubscriptionStatus(
          project.wabaId,
          project.accessToken,
        );
        setStatus(statusResult);
      } else {
        setStatus({
          isActive: false,
          error: 'Project WABA ID or Access Token not configured.',
        });
      }
    });
  };

  useEffect(() => {
    checkStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ZoruCard className="p-5">
      <div className="flex flex-row items-center justify-between gap-2">
        <div>
          <h3 className="text-[15px] text-zoru-ink">Live Status</h3>
          <p className="mt-0.5 text-[12px] text-zoru-ink-muted">
            Real-time status of your webhook subscription from Meta.
          </p>
        </div>
        <ZoruButton
          variant="outline"
          size="icon"
          onClick={checkStatus}
          disabled={isLoading}
          aria-label="Refresh status"
        >
          {isLoading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        </ZoruButton>
      </div>
      <div className="mt-4">
        {isLoading ? (
          <ZoruSkeleton className="h-10 w-full" />
        ) : status && projectId ? (
          <div className="flex items-center justify-between rounded-[var(--zoru-radius)] border border-zoru-line p-4">
            <div className="flex items-center gap-3">
              {status.isActive ? (
                <CheckCircle className="h-5 w-5 text-zoru-success" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-zoru-danger" />
              )}
              <div className="flex flex-col">
                <span
                  className={cn(
                    'text-[14px]',
                    status.isActive ? 'text-zoru-success' : 'text-zoru-danger',
                  )}
                >
                  {status.isActive ? 'Active' : 'Inactive'}
                </span>
                {status.error && (
                  <span className="font-mono text-[11px] text-zoru-ink-muted">
                    {status.error}
                  </span>
                )}
              </div>
            </div>
            <SubscribeProjectButton
              projectId={projectId}
              isActive={status.isActive}
            />
          </div>
        ) : (
          <p className="text-[13px] text-zoru-ink-muted">
            Could not determine status. Select a project.
          </p>
        )}
      </div>
    </ZoruCard>
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
      <ZoruCard className="p-5">
        <ZoruSkeleton className="h-6 w-1/3" />
        <ZoruSkeleton className="mt-2 h-4 w-2/3" />
        <div className="mt-4 flex flex-col gap-2">
          <ZoruSkeleton className="h-4 w-1/4" />
          <ZoruSkeleton className="h-10 w-full" />
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <ZoruSkeleton className="h-4 w-1/4" />
          <ZoruSkeleton className="h-10 w-full" />
        </div>
      </ZoruCard>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ZoruCard className="p-5">
        <h3 className="text-[15px] text-zoru-ink">Webhook Configuration</h3>
        <p className="mt-0.5 text-[12px] text-zoru-ink-muted">
          Copy these values into your Meta App configuration.
        </p>
        <div className="mt-4 flex flex-col gap-4">
          <InfoRow label="Callback URL" value={fullUrl} />
          <InfoRow
            label="Verify Token"
            value={verifyToken || 'Token not set in .env'}
            isSecret
          />
        </div>
      </ZoruCard>
      <WebhookStatus />
    </div>
  );
}
