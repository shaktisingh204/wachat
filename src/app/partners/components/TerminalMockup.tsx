"use client";

import React, { useState } from 'react';
import { FileJson, CheckCircle2, Play, Copy, Check } from 'lucide-react';

import { IconButton } from '@/components/sabcrm/20ui';

export function TerminalMockup() {
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [copied, setCopied] = useState(false);

  const command = "sabnode partner init --type=agency";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const runCommand = () => {
    if (running || completed) return;
    setRunning(true);
    setTimeout(() => {
      setRunning(false);
      setCompleted(true);
    }, 2000);
  };

  return (
    <div className="rounded border border-white/10 bg-black overflow-hidden relative group">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#0a0a0a]">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-white/20 group-hover:bg-white/40 transition-colors" aria-hidden="true"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-white/20 group-hover:bg-white/40 transition-colors" aria-hidden="true"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-white/20 group-hover:bg-white/40 transition-colors" aria-hidden="true"></div>
        </div>
        <div className="text-xs text-white/40 font-mono tracking-wider">partner_init.sh</div>
        <div className="flex items-center gap-3">
          <IconButton
            label={copied ? "Copied" : "Copy command"}
            icon={copied ? Check : Copy}
            size="sm"
            onClick={handleCopy}
            className="text-white/30 hover:text-white"
          />
          {!completed && !running && (
            <IconButton
              label="Run simulation"
              icon={Play}
              size="sm"
              onClick={runCommand}
              className="text-white/30 hover:text-white"
            />
          )}
          <FileJson className="w-3.5 h-3.5 text-white/30" aria-hidden="true" />
        </div>
      </div>
      <div className="p-5 text-[13px] font-mono overflow-x-auto leading-relaxed">
        <div className="text-white/30 mb-3"># Initialize a partner sandbox environment</div>
        <div className="text-white flex items-center gap-2">
          <span className="text-white/30">$</span>
          <span>{command}</span>
        </div>

        {running && (
          <div className="mt-4 text-white/50 animate-pulse">Running...</div>
        )}

        {completed && (
          <>
            <div className="text-white/50 mt-4 animate-in fade-in slide-in-from-top-1">Creating sandbox workspace <span className="text-white">agency-demo-xyz</span>...</div>
            <div className="text-white/50 animate-in fade-in slide-in-from-top-1 delay-150 fill-mode-both">Provisioning databases...</div>
            <div className="text-white/50 animate-in fade-in slide-in-from-top-1 delay-300 fill-mode-both">Applying default schema...</div>
            <div className="text-white mt-4 flex items-center gap-2 animate-in fade-in slide-in-from-top-1 delay-500 fill-mode-both">
              <CheckCircle2 className="w-4 h-4 text-white" aria-hidden="true" /> Done! Credentials saved to .env.partner
            </div>
          </>
        )}
      </div>
    </div>
  );
}
