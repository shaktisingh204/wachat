'use client';

import { useRef, useEffect, useState } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { Check, X, Clock, FileText, Send, UserCheck, CheckCircle2 } from 'lucide-react';
import { cn } from '@/components/sabcrm/20ui';

gsap.registerPlugin(useGSAP);

export type ContractStatus = 'draft' | 'sent' | 'partially_signed' | 'signed' | 'completed' | 'expired' | 'terminated' | 'voided';

const NORMAL_FLOW: ContractStatus[] = ['draft', 'sent', 'partially_signed', 'signed', 'completed'];

const ICONS = {
  draft: FileText,
  sent: Send,
  partially_signed: Clock,
  signed: UserCheck,
  completed: CheckCircle2,
  expired: Clock,
  terminated: X,
  voided: X,
};

const LABELS = {
  draft: 'Draft',
  sent: 'Sent',
  partially_signed: 'Partial',
  signed: 'Signed',
  completed: 'Completed',
  expired: 'Expired',
  terminated: 'Terminated',
  voided: 'Voided',
};

export function ContractStatusTimeline({ status }: { status: ContractStatus }) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Track previous status to animate from it
  const [prevStatus, setPrevStatus] = useState(status);
  
  const isTerminal = ['expired', 'terminated', 'voided'].includes(status);
  
  // Determine the active index in the normal flow
  let activeIndex = NORMAL_FLOW.indexOf(status);
  if (activeIndex === -1) {
    // If it's a terminal status, we might just highlight the last known good step or just show the terminal state at the end.
    // Let's just find where we were before if possible, or default to max.
    activeIndex = NORMAL_FLOW.length; 
  }

  useGSAP(() => {
    // Animate the progress bar width
    const progressPercent = Math.max(0, Math.min(100, (activeIndex / (NORMAL_FLOW.length - 1)) * 100));
    
    gsap.to('.progress-fill', {
      width: isTerminal ? '100%' : `${progressPercent}%`,
      backgroundColor: isTerminal ? '#ef4444' : '#3b82f6', // zoru-danger vs zoru-primary roughly
      duration: 0.6,
      ease: 'power2.out',
    });

    // Animate step nodes
    const nodes = gsap.utils.toArray<HTMLElement>('.step-node');
    nodes.forEach((node, i) => {
      const isPast = i < activeIndex;
      const isCurrent = i === activeIndex;
      
      if (isPast || isCurrent) {
        gsap.to(node, {
          borderColor: isTerminal && isCurrent ? '#ef4444' : '#3b82f6',
          backgroundColor: isPast ? (isTerminal ? '#ef4444' : '#3b82f6') : (isCurrent && isTerminal ? '#ef4444' : '#ffffff'),
          color: isPast ? '#ffffff' : (isTerminal && isCurrent ? '#ef4444' : '#3b82f6'),
          scale: isCurrent ? 1.1 : 1,
          duration: 0.4,
          delay: i * 0.1,
          ease: 'back.out(1.5)',
        });
      } else {
        gsap.to(node, {
          borderColor: '#e5e7eb', // zoru-line roughly
          backgroundColor: '#ffffff',
          color: '#9ca3af', // zoru-ink-muted
          scale: 1,
          duration: 0.4,
        });
      }
    });

    // Animate terminal node if active
    if (isTerminal) {
      gsap.fromTo('.terminal-node', 
        { scale: 0, opacity: 0 }, 
        { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.5)', delay: 0.3 }
      );
    } else {
      gsap.to('.terminal-node', { scale: 0, opacity: 0, duration: 0.3 });
    }

    setPrevStatus(status);
  }, { dependencies: [status, activeIndex, isTerminal], scope: containerRef });

  return (
    <div ref={containerRef} className="w-full py-6 relative">
      <div className="relative flex items-center justify-between w-full mb-2">
        {/* Background Track */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-[var(--st-border)] rounded-full z-0"></div>
        
        {/* Progress Fill */}
        <div className="progress-fill absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-[var(--st-text)] rounded-full z-0 w-0"></div>
        
        {NORMAL_FLOW.map((step, i) => {
          const Icon = ICONS[step];
          return (
            <div key={step} className="relative z-10 flex flex-col items-center gap-2 group">
              <div className="step-node flex items-center justify-center w-8 h-8 rounded-full border-2 border-[var(--st-border)] bg-white text-[var(--st-text-secondary)] transition-colors">
                <Icon className="w-4 h-4" />
              </div>
              <span className="absolute top-10 text-[11px] font-medium text-[var(--st-text)] whitespace-nowrap opacity-80 group-hover:opacity-100 transition-opacity">
                {LABELS[step]}
              </span>
            </div>
          );
        })}

        {/* Terminal State Node (only shows if terminal) */}
        <div className={cn(
          "terminal-node absolute -right-4 z-10 flex flex-col items-center gap-2",
          !isTerminal && "pointer-events-none"
        )}>
          {isTerminal && (
            <>
              <div className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-[var(--st-danger)] bg-[var(--st-danger)] text-white">
                {status === 'terminated' || status === 'voided' ? <X className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
              </div>
              <span className="absolute top-10 text-[11px] font-bold text-[var(--st-danger)] whitespace-nowrap">
                {LABELS[status as keyof typeof LABELS]}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="h-6"></div> {/* Spacer for absolute labels */}
    </div>
  );
}
