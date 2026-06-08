'use client';

import * as React from 'react';
import { Check, Code2, Copy } from 'lucide-react';

import {
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/sabcrm/20ui';

export function WidgetIntegration({ loyaltyId }: { loyaltyId: string }): React.JSX.Element {
  const [copied, setCopied] = React.useState(false);

  const snippet = `<script src="https://sabnode.com/widgets/loyalty.js" data-loyalty-id="${loyaltyId}" defer></script>`;

  const copyToClipboard = React.useCallback(() => {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [snippet]);

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center gap-[var(--st-space-2)]">
          <Code2 className="h-4 w-4 text-[var(--st-accent)]" aria-hidden="true" />
          <CardTitle>Embed widget</CardTitle>
        </div>
        <CardDescription>
          Drop this snippet into your site so customers can check their balance,
          tier, and redeem rewards.
        </CardDescription>
      </CardHeader>
      <CardBody>
        <div className="relative">
          <pre className="overflow-x-auto rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-[var(--st-space-4)] pr-12 text-[12px] leading-relaxed text-[var(--st-text)]">
            <code>{snippet}</code>
          </pre>
          <Button
            variant={copied ? 'secondary' : 'outline'}
            size="sm"
            iconLeft={copied ? Check : Copy}
            className="absolute right-2 top-2"
            onClick={copyToClipboard}
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
