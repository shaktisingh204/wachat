'use client';

import {
  IconButton,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Field,
  Input,
  Skeleton,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useTransition,
} from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Copy,
  RefreshCw,
} from 'lucide-react';

import { getWebhookSubscriptionStatus } from '@/app/actions/whatsapp.actions';
import { getProjectById } from '@/app/actions/index.ts';

/**
 * WebhookInfo (wachat-local, 20ui).
 *
 * Replaces the legacy webhook-info. Renders the callback
 * URL + verify token (read-only, copyable) and a live status card that
 * polls Meta. Server actions and copy-to-clipboard behaviour preserved.
 */

import * as React from 'react';

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
  const { toast } = useToast();

  const handleCopy = () => {
    if (!navigator.clipboard) {
      toast({
        title: 'Failed to copy',
        description:
          'Clipboard API is not available. Please use a secure (HTTPS) connection.',
        tone: 'danger',
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
          tone: 'danger',
        });
      },
    );
  };

  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <Input
          readOnly
          value={value}
          type={isSecret ? 'password' : 'text'}
          className="font-mono"
        />
        <IconButton
          variant="outline"
          icon={Copy}
          onClick={handleCopy}
          label={`Copy ${label}`}
        />
      </div>
    </Field>
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
    <Card padding="lg">
      <CardHeader>
        <div className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>Live Status</CardTitle>
            <CardDescription>
              Real-time status of your webhook subscription from Meta.
            </CardDescription>
          </div>
          <IconButton
            variant="outline"
            icon={isLoading ? RefreshCw : RefreshCw}
            onClick={checkStatus}
            disabled={isLoading}
            label="Refresh status"
            className={isLoading ? 'animate-spin' : undefined}
          />
        </div>
      </CardHeader>
      <CardBody>
        {isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : status && projectId ? (
          <Card variant="outlined" padding="md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {status.isActive ? (
                  <CheckCircle
                    className="h-5 w-5 [color:var(--st-success)]"
                    aria-hidden="true"
                  />
                ) : (
                  <AlertTriangle
                    className="h-5 w-5 [color:var(--st-danger)]"
                    aria-hidden="true"
                  />
                )}
                <div className="flex flex-col">
                  <span
                    className={
                      status.isActive
                        ? 'text-[14px] [color:var(--st-success)]'
                        : 'text-[14px] [color:var(--st-danger)]'
                    }
                  >
                    {status.isActive ? 'Active' : 'Inactive'}
                  </span>
                  {status.error && (
                    <span className="font-mono text-[11px] [color:var(--st-text-secondary)]">
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
          </Card>
        ) : (
          <p className="text-[13px] [color:var(--st-text-secondary)]">
            Could not determine status. Select a project.
          </p>
        )}
      </CardBody>
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
      <Card padding="lg">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="mt-2 h-4 w-2/3" />
        <div className="mt-4 flex flex-col gap-2">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-10 w-full" />
        </div>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card padding="lg">
        <CardHeader>
          <CardTitle>Webhook Configuration</CardTitle>
          <CardDescription>
            Copy these values into your Meta App configuration.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <div className="flex flex-col gap-4">
            <InfoRow label="Callback URL" value={fullUrl} />
            <InfoRow
              label="Verify Token"
              value={verifyToken || 'Token not set in .env'}
              isSecret
            />
          </div>
        </CardBody>
      </Card>
      <WebhookStatus />
    </div>
  );
}
