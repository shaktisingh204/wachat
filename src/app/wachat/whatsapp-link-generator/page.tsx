'use client';

import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { m, useReducedMotion } from 'motion/react';
import { Link as LinkIcon, Copy, Check, QrCode, ExternalLink } from 'lucide-react';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

import { useProject } from '@/context/project-context';
import { shortenUrlAction } from './actions';
import {
  Input,
  Label,
  Textarea,
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  useZoruToast,
} from '@/components/zoruui';
import { WaPage, PageHeader, WaButton, Section } from '@/components/wachat-ui';

/**
 * WhatsApp Link Generator - produce wa.me deep links with prefilled
 * messages. Local-only tool with optional URL shortening through
 * `shortenUrlAction` and a live QR preview.
 */

export default function WhatsAppLinkGeneratorPage() {
  const reduce = useReducedMotion();
  const { activeProject } = useProject();
  const { toast } = useZoruToast();

  const projectPhone =
    (activeProject as unknown as { phoneNumber?: string; whatsappNumber?: string })?.phoneNumber ||
    (activeProject as unknown as { whatsappNumber?: string })?.whatsappNumber ||
    '';

  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isShortening, setIsShortening] = useState(false);
  const [shortUrl, setShortUrl] = useState('');

  useEffect(() => { if (projectPhone && !phone) setPhone(projectPhone); }, [projectPhone, phone]);

  const { isValid, cleanPhone, formattedPhone } = useMemo(() => {
    let p = phone.trim();
    if (!p) return { isValid: false, cleanPhone: '', formattedPhone: '' };
    if (/^\d/.test(p)) p = '+' + p;
    const pn = parsePhoneNumberFromString(p);
    const valid = pn ? pn.isValid() : false;
    return {
      isValid: valid,
      cleanPhone: valid ? pn!.format('E.164').replace('+', '') : '',
      formattedPhone: valid ? pn!.formatInternational() : '',
    };
  }, [phone]);

  const generatedLink = useMemo(() => {
    if (!isValid || !cleanPhone) return '';
    const encoded = message.trim() ? `?text=${encodeURIComponent(message.trim())}` : '';
    return `https://wa.me/${cleanPhone}${encoded}`;
  }, [isValid, cleanPhone, message]);

  useEffect(() => { setShortUrl(''); }, [generatedLink]);

  const handleShortenLink = async () => {
    if (!generatedLink) return;
    setIsShortening(true);
    try {
      const res = await shortenUrlAction(generatedLink);
      if (res) { setShortUrl(res); toast({ title: 'Shortened', description: 'Compact link ready.' }); }
      else toast({ title: 'Error', description: 'Failed to shorten link.', variant: 'destructive' });
    } catch { toast({ title: 'Error', description: 'Could not shorten.', variant: 'destructive' }); }
    finally { setIsShortening(false); }
  };

  const qrUrl = useMemo(() => {
    if (!generatedLink) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(generatedLink)}`;
  }, [generatedLink]);

  const linkToCopy = shortUrl || generatedLink;

  const performCopy = async () => {
    if (!linkToCopy) return;
    await navigator.clipboard.writeText(linkToCopy);
    setCopied(true);
    toast({ title: 'Copied', description: 'Link copied to clipboard.' });
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <WaPage>
      <PageHeader
        title="WhatsApp link generator"
        description="Build wa.me links with a prefilled message. Shorten, scan, and share anywhere."
        kicker="Wachat · tools"
        eyebrowIcon={LinkIcon}
      />

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        {/* Form */}
        <Section title="Link details">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="link-phone">Phone number (with country code)</Label>
              <Input
                id="link-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="font-mono"
                invalid={phone.length > 0 && !isValid}
              />
              <div className="flex min-h-[20px] items-start justify-between text-[11px]">
                <div>
                  {phone && !isValid ? <span className="text-rose-600">Invalid phone number. Check country code.</span> :
                    phone && isValid ? <span className="text-emerald-600">Valid: {formattedPhone}</span> : null}
                </div>
                {projectPhone && (
                  <button
                    type="button"
                    onClick={() => setPhone(projectPhone)}
                    className="ml-2 shrink-0 font-semibold text-zinc-500 transition-colors hover:text-zinc-900 hover:underline"
                  >
                    Use project number
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="link-message">Prefilled message (optional)</Label>
              <Textarea
                id="link-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="Hi! I am interested in your services..."
                maxLength={1024}
              />
              <div className="text-right text-[11px] text-zinc-500 tabular-nums">{message.length}/1024</div>
            </div>

            {generatedLink && (
              <m.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduce ? 0 : 0.3 }}
                className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Generated link</span>
                  {!shortUrl && (
                    <button
                      type="button"
                      onClick={handleShortenLink}
                      disabled={isShortening}
                      className="text-[11.5px] font-semibold transition-colors hover:underline disabled:opacity-50"
                      style={{ color: 'var(--mt-accent)' }}
                    >
                      {isShortening ? 'Shortening...' : 'Shorten link'}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Input readOnly value={shortUrl || generatedLink} className="font-mono text-[12px]" />
                  <button
                    type="button"
                    onClick={performCopy}
                    aria-label="Copy link"
                    className="grid h-9 w-9 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-500 transition-colors hover:border-zinc-900 hover:text-zinc-900 active:scale-[0.94]"
                  >
                    {copied ? <Check className="h-3.5 w-3.5" strokeWidth={2.25} /> : <Copy className="h-3.5 w-3.5" strokeWidth={2.25} />}
                  </button>
                </div>
              </m.div>
            )}

            <div className="flex flex-wrap gap-2">
              <WaButton onClick={() => setConfirmOpen(true)} disabled={!generatedLink} leftIcon={LinkIcon}>
                {copied ? 'Copied!' : 'Copy link'}
              </WaButton>
              {generatedLink && (
                <WaButton variant="outline" rightIcon={ExternalLink} onClick={() => window.open(shortUrl || generatedLink, '_blank')}>
                  Test link
                </WaButton>
              )}
            </div>
          </div>
        </Section>

        {/* QR preview */}
        <Section title="Scan preview" description="Customers can scan to open chat instantly.">
          <div className="flex flex-col items-center justify-center py-3">
            {qrUrl ? (
              <>
                <m.img
                  key={qrUrl}
                  src={qrUrl}
                  alt="QR code"
                  layoutId={reduce ? undefined : 'wa-link-qr'}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                  width={240}
                  height={240}
                  className="rounded-2xl border border-zinc-200 shadow-[0_18px_40px_-22px_var(--mt-accent-glow)]"
                />
                <p className="mt-4 max-w-[260px] text-center text-[12px] text-zinc-500">
                  Share this QR so customers open WhatsApp pre-loaded with your message.
                </p>
                <WaButton variant="outline" size="sm" className="mt-3" onClick={() => window.open(qrUrl, '_blank')}>
                  Download QR
                </WaButton>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <QrCode className="h-16 w-16 text-zinc-300" strokeWidth={1.5} aria-hidden />
                <p className="text-[13px] text-zinc-500">Enter a phone number to generate a QR code.</p>
              </div>
            )}
          </div>
        </Section>
      </div>

      <ZoruAlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Copy this link?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              Anyone with this link can open a WhatsApp chat with the configured number and prefilled message.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <div className="break-all rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-[12px] text-zinc-900">
            {shortUrl || generatedLink}
          </div>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={async () => { await performCopy(); setConfirmOpen(false); }}>
              Copy link
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </WaPage>
  );
}
