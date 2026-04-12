'use client';

/**
 * Wachat WhatsApp Link Generator — generate wa.me links with pre-filled messages.
 */

import * as React from 'react';
import { useState, useMemo } from 'react';
import { LuLink, LuCopy, LuCheck, LuQrCode } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard } from '@/components/clay';

export default function WhatsAppLinkGeneratorPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const generatedLink = useMemo(() => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!cleanPhone) return '';
    const encodedMsg = message.trim() ? `?text=${encodeURIComponent(message.trim())}` : '';
    return `https://wa.me/${cleanPhone}${encodedMsg}`;
  }, [phone, message]);

  const qrUrl = useMemo(() => {
    if (!generatedLink) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(generatedLink)}`;
  }, [generatedLink]);

  const handleCopy = async () => {
    if (!generatedLink) return;
    await navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    toast({ title: 'Copied', description: 'Link copied to clipboard.' });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject?.name || 'Project', href: '/dashboard' },
        { label: 'Link Generator' },
      ]} />

      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">WhatsApp Link Generator</h1>
        <p className="mt-1.5 text-[13px] text-clay-ink-muted">Generate wa.me links with pre-filled messages for easy sharing.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ClayCard padded={false} className="p-6 flex flex-col gap-4">
          <div>
            <label className="text-[13px] font-medium text-clay-ink mb-1.5 block">Phone Number (with country code)</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="919876543210"
              className="w-full rounded-lg border border-clay-border bg-clay-bg px-3 py-2.5 text-sm text-clay-ink placeholder:text-clay-ink-muted focus:border-clay-accent focus:outline-none font-mono" />
          </div>
          <div>
            <label className="text-[13px] font-medium text-clay-ink mb-1.5 block">Pre-filled Message (optional)</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4}
              placeholder="Hi! I am interested in your services..."
              className="w-full rounded-lg border border-clay-border bg-clay-bg px-3 py-2 text-sm text-clay-ink placeholder:text-clay-ink-muted focus:border-clay-accent focus:outline-none resize-none" />
          </div>

          {generatedLink && (
            <div className="rounded-[12px] border border-clay-border bg-clay-surface-2 p-4">
              <div className="text-[12px] text-clay-ink-muted mb-2">Generated Link</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[13px] text-clay-accent break-all">{generatedLink}</code>
                <button onClick={handleCopy}
                  className="p-2 rounded-md hover:bg-clay-surface-2 transition-colors shrink-0" title="Copy link">
                  {copied ? <LuCheck className="h-4 w-4 text-emerald-600" /> : <LuCopy className="h-4 w-4 text-clay-ink-muted" />}
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <ClayButton variant="obsidian" size="md" onClick={handleCopy} disabled={!generatedLink}
              leading={<LuLink className="h-3.5 w-3.5" />}>
              Copy Link
            </ClayButton>
            {generatedLink && (
              <ClayButton variant="pill" size="md" onClick={() => window.open(generatedLink, '_blank')}>
                Test Link
              </ClayButton>
            )}
          </div>
        </ClayCard>

        <ClayCard padded={false} className="p-6 flex flex-col items-center justify-center">
          {qrUrl ? (
            <>
              <div className="text-[12px] text-clay-ink-muted mb-4">Scan to open chat</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrUrl} alt="QR Code for WhatsApp link" width={200} height={200} className="rounded-lg" />
              <p className="mt-4 text-[12px] text-clay-ink-muted text-center max-w-[240px]">
                Share this QR code so customers can start chatting with you instantly.
              </p>
            </>
          ) : (
            <div className="text-center py-8">
              <LuQrCode className="mx-auto h-16 w-16 text-clay-ink-muted/20 mb-4" />
              <p className="text-[13px] text-clay-ink-muted">Enter a phone number to generate QR code</p>
            </div>
          )}
        </ClayCard>
      </div>
      <div className="h-6" />
    </div>
  );
}
