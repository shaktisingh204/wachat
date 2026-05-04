'use client';

/**
 * Wachat WhatsApp Link Generator (ZoruUI).
 *
 * Generate wa.me links with pre-filled messages. Self-contained
 * client-side tool. Uses project phone number as default. Includes
 * copy-link confirmation alert dialog and live QR preview.
 */

import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link as LinkIcon, Copy, Check, QrCode } from 'lucide-react';

import { useProject } from '@/context/project-context';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruPageDescription,
  ZoruPageEyebrow,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';

export default function WhatsAppLinkGeneratorPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();

  const projectPhone =
    (activeProject as unknown as { phoneNumber?: string; whatsappNumber?: string })
      ?.phoneNumber ||
    (activeProject as unknown as { whatsappNumber?: string })?.whatsappNumber ||
    '';

  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (projectPhone && !phone) setPhone(projectPhone.replace(/[^0-9]/g, ''));
  }, [projectPhone, phone]);

  const generatedLink = useMemo(() => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!cleanPhone) return '';
    const encodedMsg = message.trim()
      ? `?text=${encodeURIComponent(message.trim())}`
      : '';
    return `https://wa.me/${cleanPhone}${encodedMsg}`;
  }, [phone, message]);

  const qrUrl = useMemo(() => {
    if (!generatedLink) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
      generatedLink,
    )}`;
  }, [generatedLink]);

  const performCopy = async () => {
    if (!generatedLink) return;
    await navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    toast({ title: 'Copied', description: 'Link copied to clipboard.' });
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Link Generator</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader className="mt-2">
        <ZoruPageHeading>
          <ZoruPageEyebrow>WaChat · Tools</ZoruPageEyebrow>
          <ZoruPageTitle>WhatsApp Link Generator</ZoruPageTitle>
          <ZoruPageDescription>
            Generate wa.me links with pre-filled messages for easy sharing.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </ZoruPageHeader>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Form column */}
        <ZoruCard className="flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="link-phone">
              Phone Number (with country code)
            </ZoruLabel>
            <ZoruInput
              id="link-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="919876543210"
              className="font-mono"
            />
            {projectPhone ? (
              <button
                type="button"
                onClick={() =>
                  setPhone(projectPhone.replace(/[^0-9]/g, ''))
                }
                className="self-start text-[11px] text-zoru-ink-muted transition-colors hover:text-zoru-ink hover:underline"
              >
                Use project number
              </button>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="link-message">
              Pre-filled Message (optional)
            </ZoruLabel>
            <ZoruTextarea
              id="link-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Hi! I am interested in your services..."
              maxLength={1024}
            />
            <div className="text-right text-[11px] text-zoru-ink-muted">
              {message.length}/1024
            </div>
          </div>

          {generatedLink ? (
            <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-4">
              <div className="mb-2 text-[12px] text-zoru-ink-muted">
                Generated Link
              </div>
              <div className="flex items-center gap-2">
                <ZoruInput
                  readOnly
                  value={generatedLink}
                  className="font-mono text-[12px]"
                />
                <ZoruButton
                  variant="outline"
                  size="icon-sm"
                  aria-label="Copy link"
                  onClick={performCopy}
                >
                  {copied ? <Check /> : <Copy />}
                </ZoruButton>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <ZoruButton
              onClick={() => setConfirmOpen(true)}
              disabled={!generatedLink}
            >
              <LinkIcon />
              {copied ? 'Copied!' : 'Copy Link'}
            </ZoruButton>
            {generatedLink ? (
              <ZoruButton
                variant="outline"
                onClick={() => window.open(generatedLink, '_blank')}
              >
                Test Link
              </ZoruButton>
            ) : null}
          </div>
        </ZoruCard>

        {/* QR preview column */}
        <ZoruCard className="flex flex-col items-center justify-center p-6">
          {qrUrl ? (
            <>
              <div className="mb-4 text-[12px] text-zoru-ink-muted">
                Scan to open chat
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrUrl}
                alt="QR Code for WhatsApp link"
                width={200}
                height={200}
                className="rounded-[var(--zoru-radius)] border border-zoru-line"
              />
              <p className="mt-4 max-w-[260px] text-center text-[12px] text-zoru-ink-muted">
                Share this QR code so customers can start chatting with you
                instantly.
              </p>
              <ZoruButton
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => window.open(qrUrl, '_blank')}
              >
                Download QR
              </ZoruButton>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <QrCode className="h-16 w-16 text-zoru-ink-subtle" />
              <p className="text-[13px] text-zoru-ink-muted">
                Enter a phone number to generate a QR code
              </p>
            </div>
          )}
        </ZoruCard>
      </div>

      {/* Copy-link confirmation */}
      <ZoruAlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Copy this link?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              Anyone with this link can open a WhatsApp chat with the configured
              number and pre-filled message.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-3 py-2 font-mono text-[12px] text-zoru-ink break-all">
            {generatedLink}
          </div>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={async () => {
                await performCopy();
                setConfirmOpen(false);
              }}
            >
              Copy link
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </div>
  );
}
