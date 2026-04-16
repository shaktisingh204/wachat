'use client';

import { useCallback } from 'react';
import { SharePanel, type FlowStatus } from './SharePanel';

interface SharePanelClientProps {
  flowId: string;
  flowName: string;
  shareUrl: string;
  initialStatus: FlowStatus;
}

export function SharePanelClient({
  flowId,
  flowName,
  shareUrl,
  initialStatus,
}: SharePanelClientProps) {
  const handlePublishToggle = useCallback(async (): Promise<FlowStatus> => {
    const res = await fetch(`/api/sabflow/${flowId}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? `Request failed (${res.status})`);
    }

    const data = (await res.json()) as { status: FlowStatus };
    return data.status;
  }, [flowId]);

  return (
    <SharePanel
      flowId={flowId}
      flowName={flowName}
      shareUrl={shareUrl}
      initialStatus={initialStatus}
      onPublishToggle={handlePublishToggle}
    />
  );
}
