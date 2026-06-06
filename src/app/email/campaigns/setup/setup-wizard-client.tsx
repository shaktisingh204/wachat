'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, ArrowRight, ArrowLeft, Send } from 'lucide-react';

import {
  Button,
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardDescription,
  Input,
  Label,
  Textarea,
  zoruToast,
  Badge,
  Checkbox,
} from '@/components/sabcrm/20ui/compat';
import { actionCreateEmailCampaign } from '@/app/actions/email/campaigns.actions';
import type { EmailListDoc, EmailSegmentDoc } from '@/lib/rust-client/email-audience';

interface SetupWizardClientProps {
  initialLists: EmailListDoc[];
  initialSegments: EmailSegmentDoc[];
}

export function SetupWizardClient({ initialLists, initialSegments }: SetupWizardClientProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();

  // Campaign State
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [fromName, setFromName] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [preheader, setPreheader] = useState('');
  const [body, setBody] = useState('<p>Hello {{ firstName }},</p>\n\n<p>Write your message here.</p>\n\n<p>Thanks,</p>');
  const [listIds, setListIds] = useState<string[]>([]);
  const [segmentIds, setSegmentIds] = useState<string[]>([]);

  const handleNext = () => setStep((s) => Math.min(s + 1, 3));
  const handlePrev = () => setStep((s) => Math.max(s - 1, 0));

  const toggleList = (id: string) => {
    setListIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  
  const toggleSegment = (id: string) => {
    setSegmentIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleCreate = () => {
    if (!name.trim() || !subject.trim() || !fromEmail.trim()) {
      zoruToast({ title: 'Missing required fields', variant: 'destructive' });
      return;
    }

    startTransition(async () => {
      const res = await actionCreateEmailCampaign({
        name: name.trim(),
        subject: subject.trim(),
        fromName: fromName.trim() || 'SabNode',
        fromEmail: fromEmail.trim(),
        body,
        preheader,
        listIds: listIds.length > 0 ? listIds : undefined,
        segmentIds: segmentIds.length > 0 ? segmentIds : undefined,
      });

      if (!res.ok) {
        zoruToast({ title: 'Failed to create campaign', description: res.error, variant: 'destructive' });
        return;
      }

      zoruToast({ title: 'Campaign created successfully' });
      router.push(`/dashboard/email/campaigns/${res.data._id}`);
    });
  };

  const steps = [
    { title: 'Basics', description: 'Internal name and subject line' },
    { title: 'Content', description: 'Design your email body' },
    { title: 'Audience', description: 'Select recipients' },
    { title: 'Review', description: 'Review and create' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 text-[var(--st-text-secondary)] mb-8">
        {steps.map((s, i) => (
          <React.Fragment key={i}>
            <div className={`flex items-center space-x-2 ${step === i ? 'text-zoru-ink-primary font-medium' : ''}`}>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${step === i ? 'bg-[var(--st-text)] text-white' : 'bg-zoru-cloud-secondary'}`}>
                {i + 1}
              </span>
              <span className="hidden sm:inline">{s.title}</span>
            </div>
            {i < steps.length - 1 && <div className="h-px w-8 bg-zoru-cloud-tertiary mx-2" />}
          </React.Fragment>
        ))}
      </div>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>{steps[step].title}</ZoruCardTitle>
          <ZoruCardDescription>{steps[step].description}</ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent>
          {step === 0 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="space-y-1">
                <Label htmlFor="name">Campaign Name</Label>
                <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Black Friday 2026" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="subject">Subject Line</Label>
                <Input id="subject" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Wait until you see this..." />
              </div>
              <div className="space-y-1">
                <Label htmlFor="preheader">Preheader (Optional)</Label>
                <Input id="preheader" value={preheader} onChange={e => setPreheader(e.target.value)} placeholder="Preview text shown in inbox" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-zoru-cloud-secondary">
                <div className="space-y-1">
                  <Label htmlFor="fromName">From Name</Label>
                  <Input id="fromName" value={fromName} onChange={e => setFromName(e.target.value)} placeholder="Acme Inc" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="fromEmail">From Email</Label>
                  <Input id="fromEmail" type="email" value={fromEmail} onChange={e => setFromEmail(e.target.value)} placeholder="hello@acme.com" />
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="space-y-1">
                <Label htmlFor="body">Email Body (HTML)</Label>
                <Textarea 
                  id="body" 
                  value={body} 
                  onChange={e => setBody(e.target.value)} 
                  rows={12} 
                  className="font-mono text-xs font-medium"
                />
                <p className="text-xs text-[var(--st-text-secondary)] mt-2">
                  Merge tags available: <code>{'{{ firstName }}'}</code>, <code>{'{{ email }}'}</code>
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in">
              <div className="space-y-3">
                <Label>Lists</Label>
                {initialLists.length === 0 ? (
                  <p className="text-sm text-[var(--st-text-secondary)]">No lists available.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {initialLists.map(list => (
                      <div key={list._id} className="flex items-center space-x-2 border rounded-md p-3 hover:bg-zoru-cloud cursor-pointer" onClick={() => toggleList(list._id)}>
                        <Checkbox checked={listIds.includes(list._id)} onCheckedChange={() => toggleList(list._id)} />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{list.name}</span>
                          <span className="text-xs text-[var(--st-text-secondary)]">{list.subscriberCount || 0} subscribers</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <Label>Segments</Label>
                {initialSegments.length === 0 ? (
                  <p className="text-sm text-[var(--st-text-secondary)]">No segments available.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {initialSegments.map(segment => (
                      <div key={segment._id} className="flex items-center space-x-2 border rounded-md p-3 hover:bg-zoru-cloud cursor-pointer" onClick={() => toggleSegment(segment._id)}>
                        <Checkbox checked={segmentIds.includes(segment._id)} onCheckedChange={() => toggleSegment(segment._id)} />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{segment.name}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in fade-in">
              <div className="rounded-md border p-4 space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-[var(--st-text-secondary)]">Campaign Settings</h4>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <span className="text-[var(--st-text-secondary)]">Name:</span> <span>{name || <span className="text-[var(--st-text)]">Missing</span>}</span>
                    <span className="text-[var(--st-text-secondary)]">Subject:</span> <span>{subject || <span className="text-[var(--st-text)]">Missing</span>}</span>
                    <span className="text-[var(--st-text-secondary)]">From:</span> <span>{fromName} &lt;{fromEmail}&gt;</span>
                  </div>
                </div>
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium text-[var(--st-text-secondary)] mb-2">Audience</h4>
                  <div className="flex flex-wrap gap-2">
                    {listIds.length === 0 && segmentIds.length === 0 && (
                      <Badge variant="outline" className="text-[var(--st-text)] border-[var(--st-border)]">No audience selected (draft mode)</Badge>
                    )}
                    {listIds.map(id => {
                      const list = initialLists.find(l => l._id === id);
                      return list ? <Badge key={id} variant="secondary">List: {list.name}</Badge> : null;
                    })}
                    {segmentIds.map(id => {
                      const segment = initialSegments.find(s => s._id === id);
                      return segment ? <Badge key={id} variant="secondary">Segment: {segment.name}</Badge> : null;
                    })}
                  </div>
                </div>
              </div>
              <p className="text-sm text-[var(--st-text-secondary)]">
                The campaign will be created as a draft. You can preview, test, and schedule it from the dashboard.
              </p>
            </div>
          )}
        </ZoruCardContent>
        <div className="flex justify-between items-center p-6 border-t border-zoru-cloud-secondary bg-zoru-cloud">
          <Button variant="outline" onClick={handlePrev} disabled={step === 0 || pending}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          {step < 3 ? (
            <Button onClick={handleNext} disabled={pending}>
              Next <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleCreate} disabled={pending}>
              <Send className="h-4 w-4 mr-2" />
              {pending ? 'Creating...' : 'Create Draft'}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
