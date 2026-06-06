'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/components/sabcrm/20ui';

export function ExitStepper({
  status,
}: {
  status: 'resignation' | 'clearance' | 'noc' | 'fnf' | 'done';
}) {
  const steps = [
    { id: 'resignation', label: 'Resignation' },
    { id: 'clearance', label: 'Clearance' },
    { id: 'noc', label: 'NOC' },
    { id: 'fnf', label: 'F&F' },
  ];

  const currentIdx = steps.findIndex((s) => s.id === status);
  const activeIdx = currentIdx === -1 ? steps.length : currentIdx;

  return (
    <div className="w-full py-6">
      <div className="relative flex items-center justify-between">
        <div className="absolute left-0 top-1/2 w-full -translate-y-1/2 h-0.5 bg-[var(--st-border)]" />
        <div 
          className="absolute left-0 top-1/2 h-0.5 -translate-y-1/2 bg-[var(--st-text)] transition-all" 
          style={{ width: `${(Math.min(activeIdx, steps.length - 1) / (steps.length - 1)) * 100}%` }}
        />
        
        {steps.map((step, idx) => {
          const isCompleted = idx < activeIdx;
          const isCurrent = idx === activeIdx;
          
          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center gap-2 bg-[var(--st-bg-secondary)] px-2">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors',
                  isCompleted 
                    ? 'border-primary bg-[var(--st-text)] text-white'
                    : isCurrent
                      ? 'border-primary bg-[var(--st-bg-secondary)] text-[var(--st-text)]'
                      : 'border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]'
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : idx + 1}
              </div>
              <span
                className={cn(
                  'text-xs font-medium',
                  isCompleted || isCurrent ? 'text-[var(--st-text)]' : 'text-[var(--st-text-secondary)]'
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
