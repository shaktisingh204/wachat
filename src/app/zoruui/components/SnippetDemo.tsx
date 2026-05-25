"use client";

import React, { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/zoruui";

export function SnippetDemo({ code, children }: { code: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className="relative group rounded-[var(--zoru-radius-lg)] border border-zoru-line overflow-hidden">
      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-2">
        <Button size="icon" variant="outline" className="h-8 w-8 bg-zoru-bg text-zoru-ink" onClick={handleCopy}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
      <div className="bg-zoru-bg p-6 flex items-center justify-center min-h-[120px]">
        {children}
      </div>
      {code && (
        <div className="border-t border-zoru-line bg-zoru-surface p-4">
          <pre className="text-xs text-zoru-ink-muted overflow-x-auto whitespace-pre-wrap">
            <code>{code}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
