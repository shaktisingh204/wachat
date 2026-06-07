"use client";

import React, { useState } from 'react';
import { ArrowRight, Building, Code2, Users, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  Button,
  Field,
  Input,
  RadioGroup,
  Radio,
  EmptyState,
} from '@/components/sabcrm/20ui';

const PARTNER_TYPES = [
  { id: 'agency', icon: Building, title: 'Agency Partner', desc: 'Build solutions for clients' },
  { id: 'tech', icon: Code2, title: 'Technology Partner', desc: 'Build integrations and apps' },
  { id: 'referral', icon: Users, title: 'Referral Partner', desc: 'Refer clients for commission' },
] as const;

export function PartnerApplicationForm() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [partnerType, setPartnerType] = useState<string>('');

  const handleNext = () => setStep(2);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(3);
    setTimeout(() => {
      setOpen(false);
      setTimeout(() => setStep(1), 500); // Reset after close animation
    }, 2500);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="primary" iconRight={ArrowRight}>
          Apply Now
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Partner Application</DialogTitle>
          <DialogDescription>
            Join the SabNode partner ecosystem and grow with us.
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-6 py-4">
            <h4 className="text-sm font-medium text-[var(--st-text)]">Select Partner Program</h4>
            <RadioGroup
              aria-label="Select partner program"
              value={partnerType}
              onValueChange={setPartnerType}
              className="grid gap-3"
            >
              {PARTNER_TYPES.map((type) => {
                const Icon = type.icon;
                const active = partnerType === type.id;
                return (
                  <label
                    key={type.id}
                    className={`flex items-start gap-4 p-4 rounded-[var(--st-radius)] border text-left cursor-pointer transition-colors ${
                      active
                        ? 'border-[var(--st-accent)] bg-[var(--st-bg-secondary)]'
                        : 'border-[var(--st-border)] hover:border-[var(--st-text-tertiary)] bg-[var(--st-bg)]'
                    }`}
                  >
                    <Radio value={type.id} className="mt-0.5" />
                    <Icon
                      className={`w-5 h-5 mt-0.5 ${active ? 'text-[var(--st-accent)]' : 'text-[var(--st-text-secondary)]'}`}
                      aria-hidden="true"
                    />
                    <div>
                      <h5 className="font-semibold text-sm text-[var(--st-text)]">{type.title}</h5>
                      <p className="text-xs text-[var(--st-text-secondary)] mt-1">{type.desc}</p>
                    </div>
                  </label>
                );
              })}
            </RadioGroup>
            <Button variant="primary" block disabled={!partnerType} onClick={handleNext}>
              Continue
            </Button>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <Field label="Company Name" required>
              <Input id="company" required placeholder="Acme Inc." />
            </Field>
            <Field label="Work Email" required>
              <Input id="email" type="email" required placeholder="you@company.com" />
            </Field>
            <Field label="Company Website">
              <Input id="website" type="url" placeholder="https://example.com" />
            </Field>
            <div className="flex gap-3 pt-4">
              <Button variant="outline" block type="button" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button variant="primary" block type="submit">
                Submit Application
              </Button>
            </div>
          </form>
        )}

        {step === 3 && (
          <div className="py-12">
            <EmptyState
              icon={CheckCircle2}
              tone="success"
              title="Application Received!"
              description="Our partner team will review your application and get back to you within 48 hours."
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
