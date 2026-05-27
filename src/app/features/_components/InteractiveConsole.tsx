'use client';

import React, { useState, useEffect } from 'react';
import { Terminal, Activity } from 'lucide-react';
import { FEATURES } from '@/lib/features/catalog';

interface InteractiveConsoleProps {
  activeCategory: string;
  activeQuery: string;
  isError: boolean;
  isLoading: boolean;
  resultCount: number;
}

export function InteractiveConsole({ activeCategory, activeQuery, isError, isLoading, resultCount }: InteractiveConsoleProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [uptime, setUptime] = useState(0);

  useEffect(() => {
    // Real-time simulated uptime & background task logger
    const interval = setInterval(() => {
      setUptime(prev => prev + 1);
      
      // Randomly push a background process log
      if (Math.random() > 0.8) {
        const events = [
          'Syncing platform metrics...',
          'Indexing new webhook endpoints...',
          'Health check passed: node-01',
          'Re-routing API traffic...',
          'Cache warmed for /api/v1/features',
          'Database latency: 12ms'
        ];
        const evt = events[Math.floor(Math.random() * events.length)];
        const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
        setLogs(prev => {
          const updated = [...prev, `[${timestamp}] ${evt}`];
          return updated.slice(-6); // Keep last 6 logs
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-10 text-white/50 border-b border-white/20 pb-4">
        <div className="flex items-center gap-3">
          <Terminal className="w-5 h-5" />
          <span className="uppercase tracking-widest text-xs font-bold">Interactive Output</span>
        </div>
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 animate-pulse text-green-400" />
          <span className="text-xs font-mono">SYS_UP: {uptime}s</span>
        </div>
      </div>

      <div className="space-y-8 flex-1">
        <div className="font-mono text-sm">
          <div className="text-white/40 mb-2">// GET /api/v1/features/status</div>
          <pre className="bg-white/5 p-4 border border-white/20 overflow-x-auto">
            <code>
{`{
  "total_features_catalog": ${FEATURES.length},
  "current_query": "${activeQuery}",
  "current_category": "${activeCategory}",
  "status": "${isError ? 'degraded' : isLoading ? 'fetching' : 'operational'}",
  "results_returned": ${resultCount}
}`}
            </code>
          </pre>
        </div>

        <div className="font-mono text-sm mt-8">
          <div className="text-white/40 mb-2">// SYSTEM.LOG -- tail -f</div>
          <pre className="bg-white/5 p-4 border border-white/20 h-48 overflow-y-hidden text-xs text-green-400/80">
            <code>
              {logs.length === 0 ? 'Waiting for events...\n' : logs.join('\n')}
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
}
