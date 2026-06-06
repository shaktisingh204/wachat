'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/sabcrm/20ui/compat';

interface CopySnippetProps {
    text: string;
    label?: string;
}

export function CopySnippet({ text, label }: CopySnippetProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy', err);
        }
    };

    return (
        <div className="flex flex-col gap-1.5">
            {label && <div className="text-[13px] font-medium text-[var(--st-text)]">{label}</div>}
            <div className="flex items-center gap-2">
                <code className="flex-1 overflow-x-auto whitespace-pre rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2 text-[12px] text-[var(--st-text)]">
                    {text}
                </code>
                <Button variant="outline" size="icon" onClick={handleCopy} className="shrink-0" aria-label="Copy to clipboard">
                    {copied ? <Check className="h-4 w-4 text-[var(--st-text)]" /> : <Copy className="h-4 w-4" />}
                </Button>
            </div>
        </div>
    );
}
