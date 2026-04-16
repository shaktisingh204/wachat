'use client';

import { useState, useCallback } from 'react';
import { saveSabFlow } from '@/app/actions/sabflow';
import { SharePanel } from './SharePanel';

interface SharePanelClientProps {
  flowId: string;
  flowName: string;
  shareUrl: string;
  initialPublicLinkEnabled: boolean;
}

export function SharePanelClient({
  flowId,
  flowName,
  shareUrl,
  initialPublicLinkEnabled,
}: SharePanelClientProps) {
  const [isPublicLinkEnabled, setIsPublicLinkEnabled] = useState(initialPublicLinkEnabled);

  const handlePublicLinkToggle = useCallback(
    async (enabled: boolean) => {
      setIsPublicLinkEnabled(enabled);
      await saveSabFlow(flowId, {
        settings: { publicLinkEnabled: enabled },
      });
    },
    [flowId],
  );

  return (
    <SharePanel
      flowId={flowId}
      flowName={flowName}
      shareUrl={shareUrl}
      isPublicLinkEnabled={isPublicLinkEnabled}
      onPublicLinkToggle={handlePublicLinkToggle}
    />
  );
}
