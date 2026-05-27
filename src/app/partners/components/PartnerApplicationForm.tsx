"use client";

import React, { useState } from 'react';
import { ArrowRight, Building, Code2, Users, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
        <button className="text-sm px-5 py-2 bg-white text-black hover:bg-zoru-surface-2 transition-colors rounded font-semibold flex items-center gap-2">
          Apply Now <ArrowRight className="w-4 h-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] bg-black border border-white/10 text-white">
        <DialogHeader>
          <DialogTitle>Partner Application</DialogTitle>
          <DialogDescription className="text-white/50">
            Join the SabNode partner ecosystem and grow with us.
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-6 py-4">
            <h4 className="text-sm font-medium mb-4">Select Partner Program</h4>
            <div className="grid gap-3">
              {[
                { id: 'agency', icon: Building, title: 'Agency Partner', desc: 'Build solutions for clients' },
                { id: 'tech', icon: Code2, title: 'Technology Partner', desc: 'Build integrations & apps' },
                { id: 'referral', icon: Users, title: 'Referral Partner', desc: 'Refer clients for commission' }
              ].map(type => (
                <button
                  key={type.id}
                  onClick={() => setPartnerType(type.id)}
                  className={`flex items-start gap-4 p-4 rounded-lg border text-left transition-all ${
                    partnerType === type.id 
                      ? 'border-white bg-white/10' 
                      : 'border-white/10 hover:border-white/30 bg-black'
                  }`}
                >
                  <type.icon className={`w-5 h-5 mt-0.5 ${partnerType === type.id ? 'text-white' : 'text-white/50'}`} />
                  <div>
                    <h5 className="font-semibold text-sm">{type.title}</h5>
                    <p className="text-xs text-white/50 mt-1">{type.desc}</p>
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={handleNext}
              disabled={!partnerType}
              className="w-full py-2.5 bg-white text-black rounded font-semibold text-sm hover:bg-zoru-surface-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="company" className="text-white/70">Company Name</Label>
              <Input id="company" required className="bg-white/5 border-white/10 text-white focus-visible:ring-white/30" placeholder="Acme Inc." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/70">Work Email</Label>
              <Input id="email" type="email" required className="bg-white/5 border-white/10 text-white focus-visible:ring-white/30" placeholder="you@company.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website" className="text-white/70">Company Website</Label>
              <Input id="website" type="url" className="bg-white/5 border-white/10 text-white focus-visible:ring-white/30" placeholder="https://example.com" />
            </div>
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 py-2.5 bg-transparent border border-white/20 text-white rounded font-semibold text-sm hover:bg-white/5 transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-white text-black rounded font-semibold text-sm hover:bg-zoru-surface-2 transition-colors"
              >
                Submit Application
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in zoom-in duration-300">
            <div className="w-12 h-12 rounded-full bg-zoru-ink/20 flex items-center justify-center mb-2">
              <CheckCircle2 className="w-6 h-6 text-zoru-ink-muted" />
            </div>
            <h3 className="text-xl font-bold">Application Received!</h3>
            <p className="text-sm text-white/50 max-w-[250px]">
              Our partner team will review your application and get back to you within 48 hours.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
