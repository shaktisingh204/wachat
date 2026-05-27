'use client';

import * as React from 'react';
import { Copy, Link as LinkIcon, Check } from 'lucide-react';
import { Button } from '@/components/zoruui';

export function PortalLinkCopy({ vendorId }: { vendorId: string }) {
    const [copied, setCopied] = React.useState(false);

    // This would be the actual portal link path
    const portalLink = typeof window !== 'undefined' 
      ? `${window.location.origin}/portal/vendor/${vendorId}`
      : `/portal/vendor/${vendorId}`;

    const handleCopy = () => {
        if (typeof navigator !== 'undefined') {
            navigator.clipboard.writeText(portalLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="flex items-center gap-2 mt-4 p-3 rounded-lg border border-zoru-line bg-zoru-surface-2 text-[13px]">
            <LinkIcon className="h-4 w-4 text-zoru-ink-muted shrink-0" />
            <span className="truncate text-zoru-ink-muted flex-1">
                {portalLink}
            </span>
            <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0 h-7 text-xs">
                {copied ? <Check className="h-3.5 w-3.5 mr-1 text-zoru-ink" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                {copied ? 'Copied' : 'Copy link'}
            </Button>
        </div>
    );
}
