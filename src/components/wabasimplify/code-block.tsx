
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
  wrap?: boolean;
}

export function CodeBlock({ code, language, className, wrap }: CodeBlockProps) {
  const [hasCopied, setHasCopied] = useState(false);
  const { toast } = useToast();

  const onCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
      toast({ title: 'Copied to clipboard!' });
    });
  };

  return (
    <div className={cn("relative rounded-lg bg-muted/50 p-4 font-mono text-sm", className)}>
      <Button
        size="icon"
        variant="ghost"
        className="absolute right-2 top-2 h-7 w-7"
        onClick={onCopy}
      >
        {hasCopied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
        <span className="sr-only">Copy code</span>
      </Button>
      <pre className={cn("overflow-hidden", wrap && "whitespace-pre-wrap break-all")}>
        <code
          className={cn(
            language ? `language-${language}` : '',
            wrap && "whitespace-pre-wrap break-all block"
          )}
          style={wrap ? { overflowWrap: 'anywhere' } : {}}
        >
          {code.trim()}
        </code>
      </pre>
    </div>
  );
}
