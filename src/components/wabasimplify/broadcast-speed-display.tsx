
'use client';

import { useState, useEffect, useRef } from 'react';
import type { WithId } from 'mongodb';

type Broadcast = {
  _id: any;
  status: 'QUEUED' | 'PROCESSING' | 'Completed' | 'Failed' | 'Partial Failure' | 'Cancelled';
  startedAt?: string;
  completedAt?: string;
  successCount?: number;
  errorCount?: number;
  projectMessagesPerSecond?: number;
};

interface SpeedDisplayProps {
  item: WithId<Broadcast>;
}

export function SpeedDisplay({ item }: SpeedDisplayProps) {
  const [sendingSpeed, setSendingSpeed] = useState(0);
  const [acceptingSpeed, setAcceptingSpeed] = useState(0);
  const lastProcessedRef = useRef(0);
  const lastSuccessRef = useRef(0);
  const lastTimestampRef = useRef(Date.now());

  useEffect(() => {
    const calculateSpeeds = () => {
        if (item.status !== 'PROCESSING' || !item.startedAt) {
            // For completed jobs, calculate final average speed
            if (item.startedAt && item.completedAt) {
                const durationSeconds = (new Date(item.completedAt).getTime() - new Date(item.startedAt).getTime()) / 1000;
                if (durationSeconds > 0) {
                    const totalProcessed = (item.successCount || 0) + (item.errorCount || 0);
                    setSendingSpeed(Math.round(totalProcessed / durationSeconds));
                    setAcceptingSpeed(Math.round((item.successCount || 0) / durationSeconds));
                }
            }
            return;
        }

        const now = Date.now();
        const totalProcessed = (item.successCount || 0) + (item.errorCount || 0);
        const totalSuccess = item.successCount || 0;

        const timeDiffSeconds = (now - lastTimestampRef.current) / 1000;
        
        if (timeDiffSeconds > 0) {
            const processedInInterval = totalProcessed - lastProcessedRef.current;
            const successInInterval = totalSuccess - lastSuccessRef.current;
            setSendingSpeed(Math.round(processedInInterval / timeDiffSeconds));
            setAcceptingSpeed(Math.round(successInInterval / timeDiffSeconds));
        }
        
        lastProcessedRef.current = totalProcessed;
        lastSuccessRef.current = totalSuccess;
        lastTimestampRef.current = now;
    };

    calculateSpeeds(); // Initial calculation

    let intervalId: NodeJS.Timeout | undefined;
    if (item.status === 'PROCESSING') {
        intervalId = setInterval(calculateSpeeds, 2000); // Update every 2 seconds for active jobs
    }

    return () => {
        if (intervalId) {
            clearInterval(intervalId);
        }
    };
  }, [item]);

  const limit = item.projectMessagesPerSecond;

  return (
    <div className="font-mono text-xs text-muted-foreground space-y-1" title="App Sending Speed / Meta Accepting Speed / Limit">
      <div>App Speed: {sendingSpeed} msg/s</div>
      <div>Meta Speed: {acceptingSpeed} msg/s</div>
      <div>Limit: {limit !== undefined && limit !== null ? `${limit} msg/s` : 'N/A'}</div>
    </div>
  );
}
