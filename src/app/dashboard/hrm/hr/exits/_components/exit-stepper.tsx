'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/components/zoruui';

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
        <div className="absolute left-0 top-1/2 w-full -translate-y-1/2 h-0.5 bg-zoru-line" />
        <div 
          className="absolute left-0 top-1/2 h-0.5 -translate-y-1/2 bg-zoru-ink transition-all" 
          style={{ width: `${(Math.min(activeIdx, steps.length - 1) / (steps.length - 1)) * 100}%` }}
        />
        
        {steps.map((step, idx) => {
          const isCompleted = idx < activeIdx;
          const isCurrent = idx === activeIdx;
          
          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center gap-2 bg-zoru-surface px-2">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors',
                  isCompleted 
                    ? 'border-primary bg-zoru-ink text-white'
                    : isCurrent
                      ? 'border-primary bg-zoru-surface text-zoru-ink'
                      : 'border-zoru-line bg-zoru-surface text-zoru-ink-muted'
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : idx + 1}
              </div>
              <span
                className={cn(
                  'text-xs font-medium',
                  isCompleted || isCurrent ? 'text-zoru-ink' : 'text-zoru-ink-muted'
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
