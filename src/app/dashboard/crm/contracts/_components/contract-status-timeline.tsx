'use client';

import React, { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/sabcrm/20ui/compat';
import { CheckCircle2, FileText, Send, XCircle } from 'lucide-react';

interface ContractStatusTimelineProps {
  status: string;
  sentAt?: string | Date;
  signedAt?: string | Date;
  voidedAt?: string | Date;
}

const ALL_STEPS = ['draft', 'sent', 'signed'];

export function ContractStatusTimeline({
  status,
  voidedAt,
}: ContractStatusTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const s = status.toLowerCase();
  
  const isTerminated = s === 'terminated' || s === 'expired' || voidedAt;
  
  let currentStepIdx = ALL_STEPS.indexOf(s);
  if (isTerminated) {
    currentStepIdx = 2; // Show error on the last step
  } else if (currentStepIdx === -1) {
    currentStepIdx = 0; // Default to draft
  }

  useGSAP(() => {
    // animate steps sequentially
    gsap.from('.timeline-step', {
      opacity: 0,
      y: 20,
      stagger: 0.15,
      duration: 0.5,
      ease: 'power2.out',
    });
    
    gsap.from('.timeline-connector', {
      scaleX: 0,
      transformOrigin: 'left center',
      stagger: 0.15,
      duration: 0.5,
      ease: 'power2.out',
      delay: 0.15,
    });
  }, { scope: containerRef, dependencies: [status] });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Status Timeline</CardTitle>
      </CardHeader>
      <CardBody>
        <div ref={containerRef} className="flex items-center w-full max-w-2xl py-4 overflow-hidden">
          {ALL_STEPS.map((step, i) => {
            const isCompleted = i < currentStepIdx;
            const isCurrent = i === currentStepIdx;
            const isActive = isCompleted || isCurrent;
            const isError = isTerminated && isCurrent;
            
            return (
              <React.Fragment key={step}>
                <div className="timeline-step flex flex-col items-center relative z-10 w-20">
                  <div
                    className={`h-10 w-10 rounded-full flex items-center justify-center border-2 transition-colors duration-300
                      ${isError ? 'border-destructive bg-[var(--st-text)]/10 text-[var(--st-text)]' 
                        : isActive ? 'border-primary bg-[var(--st-text)]/10 text-[var(--st-text)]' : 'border-muted bg-[var(--st-bg-muted)]/20 text-[var(--st-text-secondary)]'}`}
                  >
                    {step === 'draft' && <FileText className="h-5 w-5" />}
                    {step === 'sent' && <Send className="h-5 w-5" />}
                    {step === 'signed' && (isError ? <XCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />)}
                  </div>
                  <span className={`mt-2 text-[11px] font-medium uppercase tracking-wider text-center
                    ${isError ? 'text-[var(--st-text)]' : isActive ? 'text-[var(--st-text)]' : 'text-[var(--st-text-secondary)]'}`}>
                    {isError && step === 'signed' ? status : step}
                  </span>
                </div>
                {i < ALL_STEPS.length - 1 && (
                  <div className="flex-1 px-2">
                    <div className={`timeline-connector h-1 w-full rounded-full transition-colors duration-300
                      ${isCompleted && !isTerminated ? 'bg-[var(--st-text)]' : 'bg-[var(--st-bg-muted)]'}`} 
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}
