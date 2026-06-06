'use client';

import * as React from 'react';

import { Badge } from '@/components/sabcrm/20ui/compat';

interface ValidityCountdownProps {
  validUpto: string;
  status: 'active' | 'cancelled' | 'expired';
}

function formatDelta(ms: number): string {
  if (ms <= 0) return 'Expired';
  const totalMins = Math.floor(ms / 60_000);
  const days = Math.floor(totalMins / (60 * 24));
  const hrs = Math.floor((totalMins % (60 * 24)) / 60);
  const mins = totalMins % 60;
  if (days > 0) return `${days}d ${hrs}h`;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

export function ValidityCountdown({ validUpto, status }: ValidityCountdownProps) {
  const target = React.useMemo(() => {
    const t = new Date(validUpto).getTime();
    return Number.isFinite(t) ? t : null;
  }, [validUpto]);

  const [now, setNow] = React.useState<number>(() => Date.now());

  React.useEffect(() => {
    if (status !== 'active' || target === null) return;
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [status, target]);

  if (target === null) {
    return <span className="text-[12.5px] text-[var(--st-text-secondary)]">—</span>;
  }

  if (status === 'cancelled') {
    return <Badge variant="danger">Cancelled</Badge>;
  }

  const delta = target - now;
  if (delta <= 0 || status === 'expired') {
    return <Badge variant="warning">Expired</Badge>;
  }

  const hours = delta / (60 * 60 * 1000);
  const tone: 'success' | 'warning' = hours < 24 ? 'warning' : 'success';

  return (
    <div className="flex flex-col gap-0.5">
      <Badge variant={tone}>{`Expires in ${formatDelta(delta)}`}</Badge>
      <span className="text-[11px] text-[var(--st-text-secondary)]">
        {(() => {
          const date = new Date(target);
          const day = String(date.getUTCDate()).padStart(2, '0');
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const month = months[date.getUTCMonth()];
          const year = date.getUTCFullYear();
          const hours = String(date.getUTCHours()).padStart(2, '0');
          const minutes = String(date.getUTCMinutes()).padStart(2, '0');
          return `${day} ${month} ${year} ${hours}:${minutes} UTC`;
        })()}
      </span>
    </div>
  );
}
