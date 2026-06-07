"use client";

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

import { Badge, IconButton, useToast } from '@/components/sabcrm/20ui';

interface Props {
  method: string;
  endpoint: string;
  code: string;
  isWebhook?: boolean;
}

export function CopyableCodeBlock({ method, endpoint, code, isWebhook = false }: Props) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success('Code copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
      <div className="flex items-center justify-between border-b border-[var(--st-border)] bg-[var(--st-bg)] px-4 py-3">
        <div className="flex items-center gap-3">
          <Badge
            tone={isWebhook ? 'neutral' : 'accent'}
            kind={isWebhook ? 'outline' : 'solid'}
            className="uppercase tracking-widest"
          >
            {method}
          </Badge>
          <span className="font-mono text-xs text-[var(--st-text-secondary)]">{endpoint}</span>
        </div>
        <IconButton
          icon={copied ? Check : Copy}
          label={copied ? 'Copied' : 'Copy code'}
          size="sm"
          onClick={handleCopy}
          className="opacity-0 transition-opacity group-hover:opacity-100"
        />
      </div>
      <div className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed text-[var(--st-text)]">
        <pre>
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}
