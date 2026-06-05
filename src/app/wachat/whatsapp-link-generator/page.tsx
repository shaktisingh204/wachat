'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  Textarea,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  useEffect,
  useMemo,
  useState } from 'react';
import { Link as LinkIcon,
  Copy,
  Check,
  QrCode } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { shortenUrlAction } from './actions';
import { WachatPage } from '@/app/wachat/_components/wachat-page';

/**
 * Wachat WhatsApp Link Generator (20ui).
 *
 * Generate wa.me links with pre-filled messages. Self-contained
 * client-side tool. Uses project phone number as default. Includes
 * copy-link confirmation alert dialog and live QR preview.
 */

export default function WhatsAppLinkGeneratorPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();

  const projectPhone =
    (activeProject as unknown as { phoneNumber?: string; whatsappNumber?: string })
      ?.phoneNumber ||
    (activeProject as unknown as { whatsappNumber?: string })?.whatsappNumber ||
    '';

  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isShortening, setIsShortening] = useState(false);
  const [shortUrl, setShortUrl] = useState('');

  useEffect(() => {
    if (projectPhone && !phone) setPhone(projectPhone);
  }, [projectPhone, phone]);

  const { isValid, cleanPhone, formattedPhone } = useMemo(() => {
    let p = phone.trim();
    if (!p) return { isValid: false, cleanPhone: '', formattedPhone: '' };
    if (/^\d/.test(p)) {
      p = '+' + p;
    }
    const pn = parsePhoneNumberFromString(p);
    const valid = pn ? pn.isValid() : false;
    const clean = valid ? pn!.format('E.164').replace('+', '') : '';
    const formatted = valid ? pn!.formatInternational() : '';
    return { isValid: valid, cleanPhone: clean, formattedPhone: formatted };
  }, [phone]);

  const generatedLink = useMemo(() => {
    if (!isValid || !cleanPhone) return '';
    const encodedMsg = message.trim()
      ? `?text=${encodeURIComponent(message.trim())}`
      : '';
    return `https://wa.me/${cleanPhone}${encodedMsg}`;
  }, [isValid, cleanPhone, message]);

  useEffect(() => {
    setShortUrl('');
  }, [generatedLink]);

  const handleShortenLink = async () => {
    if (!generatedLink) return;
    setIsShortening(true);
    try {
      const res = await shortenUrlAction(generatedLink);
      if (res) {
        setShortUrl(res);
        toast({ title: 'Success', description: 'Link shortened successfully.', tone: 'success' });
      } else {
        toast({ title: 'Error', description: 'Failed to shorten link.', tone: 'danger' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'An error occurred while shortening.', tone: 'danger' });
    } finally {
      setIsShortening(false);
    }
  };

  const qrUrl = useMemo(() => {
    if (!generatedLink) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
      generatedLink,
    )}`;
  }, [generatedLink]);

  const linkToCopy = shortUrl || generatedLink;

  const performCopy = async () => {
    if (!linkToCopy) return;
    await navigator.clipboard.writeText(linkToCopy);
    setCopied(true);
    toast({ title: 'Copied', description: 'Link copied to clipboard.', tone: 'success' });
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Link Generator' },
      ]}
      eyebrow="WaChat · Tools"
      title="WhatsApp Link Generator"
      description="Generate wa.me links with pre-filled messages for easy sharing."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Form column */}
        <Card className="flex flex-col gap-4" padding="lg">
          <Field
            label="Phone Number (with country code)"
            error={
              phone.length > 0 && !isValid
                ? 'Invalid phone number. Check country code.'
                : undefined
            }
            help={
              phone && isValid ? (
                <span className="text-[var(--st-status-ok)]">Valid: {formattedPhone}</span>
              ) : undefined
            }
          >
            <Input
              id="link-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="font-mono"
              invalid={phone.length > 0 && !isValid}
            />
          </Field>

          {projectPhone ? (
            <div className="-mt-2 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPhone(projectPhone)}
                className="shrink-0 text-[11px]"
              >
                Use project number
              </Button>
            </div>
          ) : null}

          <Field
            label="Pre-filled Message (optional)"
            help={
              <span className="block text-right">
                {message.length}/1024
              </span>
            }
          >
            <Textarea
              id="link-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Hi! I am interested in your services..."
              maxLength={1024}
            />
          </Field>

          {generatedLink ? (
            <Card variant="outlined" padding="sm" className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="u-card__desc text-[12px]">Generated Link</span>
                {!shortUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleShortenLink}
                    disabled={isShortening}
                    className="text-[11px] font-medium"
                  >
                    {isShortening ? 'Shortening...' : 'Shorten link'}
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={shortUrl || generatedLink}
                  className="font-mono text-[12px]"
                />
                <IconButton
                  variant="outline"
                  size="sm"
                  label="Copy link"
                  icon={copied ? Check : Copy}
                  onClick={performCopy}
                />
              </div>
            </Card>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button
              variant="primary"
              iconLeft={LinkIcon}
              onClick={() => setConfirmOpen(true)}
              disabled={!generatedLink}
            >
              {copied ? 'Copied!' : 'Copy Link'}
            </Button>
            {generatedLink ? (
              <Button
                variant="outline"
                onClick={() => window.open(shortUrl || generatedLink, '_blank')}
              >
                Test Link
              </Button>
            ) : null}
          </div>
        </Card>

        {/* QR preview column */}
        <Card className="flex flex-col items-center justify-center" padding="lg">
          {qrUrl ? (
            <>
              <p className="u-card__desc mb-4 text-[12px]">Scan to open chat</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrUrl}
                alt="QR Code for WhatsApp link"
                width={200}
                height={200}
                className="u-card u-card--outlined"
              />
              <p className="u-card__desc mt-4 max-w-[260px] text-center text-[12px]">
                Share this QR code so customers can start chatting with you
                instantly.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => window.open(qrUrl, '_blank')}
              >
                Download QR
              </Button>
            </>
          ) : (
            <EmptyState
              icon={QrCode}
              title="Enter a phone number to generate a QR code"
            />
          )}
        </Card>
      </div>

      {/* Copy-link confirmation */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Copy this link?</AlertDialogTitle>
            <AlertDialogDescription>
              Anyone with this link can open a WhatsApp chat with the configured
              number and pre-filled message.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Card variant="outlined" padding="sm" className="font-mono text-[12px] break-all">
            {shortUrl || generatedLink}
          </Card>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              intent="primary"
              onClick={async () => {
                await performCopy();
                setConfirmOpen(false);
              }}
            >
              Copy link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WachatPage>
  );
}
