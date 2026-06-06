'use client';

import * as React from 'react';
import { Button, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle, Input } from '@/components/sabcrm/20ui/compat';
import { Calendar, Copy, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export function CalendlySchedulingCard({ candidateName, candidateEmail }: { candidateName: string; candidateEmail: string }) {
  const [copied, setCopied] = React.useState(false);
  const [link, setLink] = React.useState('');

  const generateLink = () => {
    // Generate a Calendly link pre-filled with candidate details
    const baseUrl = 'https://calendly.com/your-org/interview';
    const params = new URLSearchParams({
      name: candidateName || '',
      email: candidateEmail || '',
    });
    setLink(`${baseUrl}?${params.toString()}`);
    toast.success('Calendly link generated');
  };

  const copyToClipboard = () => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="mt-6">
      <ZoruCardHeader>
        <ZoruCardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Calendar className="h-4 w-4" />
          Calendly Scheduling
        </ZoruCardTitle>
      </ZoruCardHeader>
      <ZoruCardContent>
        {!link ? (
          <Button variant="outline" size="sm" onClick={generateLink} className="w-full">
            Generate Interview Link
          </Button>
        ) : (
          <div className="flex gap-2">
            <Input value={link} readOnly className="h-8 text-xs" />
            <Button variant="secondary" size="icon" className="h-8 w-8 shrink-0" onClick={copyToClipboard}>
              {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </ZoruCardContent>
    </Card>
  );
}
