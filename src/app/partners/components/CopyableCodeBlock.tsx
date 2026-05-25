"use client";

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface Props {
  method: string;
  endpoint: string;
  code: string;
  isWebhook?: boolean;
}

export function CopyableCodeBlock({ method, endpoint, code, isWebhook = false }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded border border-white/10 bg-black overflow-hidden relative group">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#0a0a0a]">
        <div className="flex items-center gap-3">
          <div className={`px-2 py-0.5 text-[10px] font-bold tracking-widest rounded-sm uppercase ${isWebhook ? 'border border-white/20 text-white' : 'bg-white text-black'}`}>
            {method}
          </div>
          <div className="text-xs text-white/50 font-mono">{endpoint}</div>
        </div>
        <button 
          onClick={handleCopy} 
          className="text-white/30 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
          title="Copy Code"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
      <div className="p-5 text-[13px] font-mono overflow-x-auto text-white/70 leading-relaxed">
        <pre><code>{code}</code></pre>
      </div>
    </div>
  );
}
