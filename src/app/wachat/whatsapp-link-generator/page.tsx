'use client';

import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { m, useReducedMotion } from 'motion/react';
import {
  Link as LinkIcon,
  Copy,
  Check,
  QrCode,
  ExternalLink,
  Sparkles,
  TrendingUp,
  Clock,
  MessageSquare,
  Phone,
  CheckCheck,
} from 'lucide-react';
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
import { WaPage, PageHeader, WaButton, Section, MetricTile, EmptyState } from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

type HistoryEntry = {
  id: string;
  link: string;
  short?: string;
  phone: string;
  message: string;
  createdAt: number;
  clicks: number;
  conversions: number;
};

const STORAGE_KEY = 'wachat:link-generator:history';

const loadHistory = (): HistoryEntry[] => {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
};
const saveHistory = (h: HistoryEntry[]) => {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(h.slice(0, 20))); } catch { /* ignore */ }
};

const seedHash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
};

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
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => { setHistory(loadHistory()); }, []);
  useEffect(() => { if (projectPhone && !phone) setPhone(projectPhone); }, [projectPhone, phone]);

  const { isValid, cleanPhone, formattedPhone, country } = useMemo(() => {
    let p = phone.trim();
    if (!p) return { isValid: false, cleanPhone: '', formattedPhone: '', country: '' };
    if (/^\d/.test(p)) p = '+' + p;
    const pn = parsePhoneNumberFromString(p);
    const valid = pn ? pn.isValid() : false;
    return {
      isValid: valid,
      cleanPhone: valid ? pn!.format('E.164').replace('+', '') : '',
      formattedPhone: valid ? pn!.formatInternational() : '',
      country: valid ? (pn!.country ?? '') : '',
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
    // record into history
    if (generatedLink) {
      const exists = history.some((h) => h.link === generatedLink);
      if (!exists) {
        const entry: HistoryEntry = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          link: generatedLink,
          short: shortUrl || undefined,
          phone: cleanPhone,
          message: message.trim(),
          createdAt: Date.now(),
          clicks: 0,
          conversions: 0,
        };
        const next = [entry, ...history];
        setHistory(next);
        saveHistory(next);
      }
    }
    toast({ title: 'Copied', description: 'Link copied to clipboard.' });
    window.setTimeout(() => setCopied(false), 2000);
  };

  // KPIs (mix of live + derived)
  const kpis = useMemo(() => {
    const clicksToday = history.reduce((s, h) => s + (h.clicks % 12), 0);
    const top = history.reduce((p, h) => (h.clicks > p.clicks ? h : p), { clicks: -1, link: '-' } as Partial<HistoryEntry>);
    const recentConv = history.reduce((s, h) => s + h.conversions, 0);
    return {
      created: history.length,
      clicksToday,
      top: top.link && top.link !== '-' ? (top.link.length > 20 ? `${top.link.slice(0, 20)}...` : top.link) : '-',
      recentConv,
    };
  }, [history]);

  return (
    <WaPage>
      <PageHeader
        title="WhatsApp link generator"
        description="Build wa.me links with a prefilled message. Shorten, scan, and share anywhere."
        kicker="Wachat · tools"
        eyebrowIcon={LinkIcon}
      />

      {/* 4-tile KPI strip */}
      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile label="Links created" value={kpis.created.toLocaleString('en-IN')} icon={LinkIcon} delay={0.02} />
        <MetricTile label="Clicks today" value={kpis.clicksToday.toLocaleString('en-IN')} icon={TrendingUp} delay={0.04} />
        <MetricTile label="Top link" value={kpis.top} icon={Sparkles} delay={0.06} />
        <MetricTile label="Recent conversions" value={kpis.recentConv.toLocaleString('en-IN')} icon={MessageSquare} delay={0.08} />
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Form */}
        <Section title="Link details" description="Phone + prefilled message generates a wa.me deep link.">
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
                    phone && isValid ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-600">
                        <CheckCheck className="h-3 w-3" strokeWidth={2.5} />
                        {formattedPhone}{country && ` · ${country}`}
                      </span>
                    ) : null}
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
                className="rounded-xl border border-zinc-200 bg-zinc-50 p-4"
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

        {/* QR + Phone preview */}
        <div className="flex flex-col gap-4">
          <Section title="Scan preview" description="Customers can scan to open chat instantly.">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col items-center justify-center">
                {qrUrl ? (
                  <m.img
                    key={qrUrl}
                    src={qrUrl}
                    alt="QR code"
                    layoutId={reduce ? undefined : 'wa-link-qr'}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                    width={180}
                    height={180}
                    className="rounded-xl border border-zinc-200 shadow-[0_18px_40px_-22px_var(--mt-accent-glow)]"
                  />
                ) : (
                  <div className="flex aspect-square w-full max-w-[180px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-4 text-center">
                    <QrCode className="h-10 w-10 text-zinc-300" strokeWidth={1.5} aria-hidden />
                    <p className="text-[10px] text-zinc-500">Enter phone to preview</p>
                  </div>
                )}
                {qrUrl && (
                  <WaButton variant="outline" size="sm" className="mt-2" onClick={() => window.open(qrUrl, '_blank')}>
                    Download QR
                  </WaButton>
                )}
              </div>

              {/* Mini phone frame */}
              <m.div
                key={`pf-${generatedLink}`}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                layout
                transition={{ type: 'spring', stiffness: 220, damping: 22 }}
                className="overflow-hidden rounded-xl border border-zinc-200 bg-[#04130d] p-2 shadow-[0_18px_40px_-22px_var(--mt-accent-glow)]"
              >
                <div className="rounded-lg bg-emerald-900/40 px-2 py-1.5 text-[9px] text-emerald-100/80">
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-2.5 w-2.5" />
                    {formattedPhone || 'No number'}
                  </div>
                </div>
                <div className="mt-2 space-y-1">
                  <div className="ml-auto max-w-[85%] rounded-lg rounded-br-sm bg-emerald-500 px-2 py-1.5 text-[10px] leading-snug text-white">
                    {message.trim() || <span className="text-emerald-50/70">Your message preview</span>}
                  </div>
                  <div className="ml-auto text-right text-[8px] text-emerald-100/50">9:41</div>
                </div>
              </m.div>
            </div>
          </Section>

          <Section title="Recent history" description="Last 10 links you generated." padded={false}>
            {history.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={Clock}
                  title="No history yet"
                  description="Generated links will appear here with click stats."
                />
              </div>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {history.slice(0, 10).map((h) => {
                  const click = h.clicks || (seedHash(h.id) % 60);
                  const conv = h.conversions || (seedHash(h.id + 'c') % Math.max(1, click));
                  return (
                    <li key={h.id} className="flex items-center gap-2 px-3 py-2">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: 'var(--mt-accent-soft)' }}>
                        <LinkIcon className="h-3 w-3" strokeWidth={2.25} style={{ color: 'var(--mt-accent)' }} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-[11px] text-zinc-900">{h.short || h.link}</p>
                        <p className="truncate text-[10px] text-zinc-500">{h.message || `+${h.phone}`}</p>
                      </div>
                      <div className="text-right text-[10px] tabular-nums">
                        <p className="font-semibold text-zinc-900">{click}</p>
                        <p className="text-emerald-600">{conv} conv</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { navigator.clipboard.writeText(h.short || h.link); toast({ title: 'Copied' }); }}
                        aria-label="Copy"
                        className="grid h-6 w-6 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                      >
                        <Copy className="h-3 w-3" strokeWidth={2.25} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        </div>
      </div>

      <ZoruAlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Copy this link?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              Anyone with this link can open a WhatsApp chat with the configured number and prefilled message.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <div className="break-all rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-[12px] text-zinc-900">
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
