'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { m, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  QrCode,
  Plus,
  Trash2,
  Pencil,
  RefreshCw,
  Copy,
  Download,
  BarChart3,
  Image as ImageIcon,
  TrendingUp,
  Clock,
  MessageSquare,
} from 'lucide-react';
import QRCode from 'qrcode';

import { useProject } from '@/context/project-context';
import {
  getQrCodes,
  handleCreateQrCode,
  handleUpdateQrCode,
  handleDeleteQrCode,
} from '@/app/actions/whatsapp.actions';
import {
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  Input,
  Label,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  WaPage,
  PageHeader,
  WaButton,
  EmptyState,
  MetricTile,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

type QrCodeRow = {
  code: string;
  prefilled_message: string;
  deep_link_url: string;
  qr_image_url?: string;
  createdAt?: string;
};

const seedHash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
};
const mockScans = (code: string) => seedHash(code) % 1500;
const mockScansToday = (code: string) => seedHash(code + 't') % 60;
const mockConvRate = (code: string) => 8 + (seedHash(code + 'c') % 40);
const mockSparkline = (code: string): number[] => {
  const base = seedHash(code);
  return Array.from({ length: 14 }, (_, i) => 4 + ((base >> i) & 0x1f));
};
const mockLastScan = (code: string) => {
  const h = seedHash(code + 'l');
  const days = h % 10;
  const hours = (h >> 4) % 24;
  if (days === 0 && hours < 1) return 'just now';
  if (days === 0) return `${hours}h ago`;
  return `${days}d ago`;
};

const trackingUrl = (qr: QrCodeRow) => `https://sabnode.com/r/qr/${qr.code}`;

const generateCustomQr = async (text: string, fg: string, bg: string, logoUrl?: string) => {
  const qrDataUrl = await QRCode.toDataURL(text, {
    errorCorrectionLevel: 'H',
    margin: 1,
    color: { dark: fg, light: bg },
    width: 1024,
  });
  if (!logoUrl) return qrDataUrl;
  return new Promise<string>((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) return resolve(qrDataUrl);
    const qrImg = new Image();
    qrImg.onload = () => {
      ctx.drawImage(qrImg, 0, 0, 1024, 1024);
      const logoImg = new Image();
      logoImg.crossOrigin = 'anonymous';
      logoImg.onload = () => {
        const logoSize = 1024 * 0.2;
        const x = (1024 - logoSize) / 2;
        const y = (1024 - logoSize) / 2;
        ctx.fillStyle = bg;
        ctx.fillRect(x - 10, y - 10, logoSize + 20, logoSize + 20);
        ctx.drawImage(logoImg, x, y, logoSize, logoSize);
        resolve(canvas.toDataURL('image/png'));
      };
      logoImg.onerror = () => resolve(qrDataUrl);
      logoImg.src = logoUrl;
    };
    qrImg.onerror = () => reject(new Error('Failed to load QR image'));
    qrImg.src = qrDataUrl;
  });
};

function ClientQrPreview({
  text, fgColor, bgColor, logoUrl, size = 220, onDataUrlReady,
}: {
  text: string;
  fgColor: string;
  bgColor: string;
  logoUrl?: string;
  size?: number;
  onDataUrlReady?: (url: string) => void;
}) {
  const reduce = useReducedMotion();
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setError(false);
        const url = await generateCustomQr(text, fgColor, bgColor, logoUrl);
        if (active) { setDataUrl(url); onDataUrlReady?.(url); }
      } catch {
        if (active) setError(true);
      }
    })();
    return () => { active = false; };
  }, [text, fgColor, bgColor, logoUrl, onDataUrlReady]);

  if (error) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-sm text-zinc-500" style={{ width: '100%', maxWidth: size, aspectRatio: '1/1' }}>
        Failed to load QR
      </div>
    );
  }
  if (!dataUrl) {
    return <div className="animate-pulse rounded-xl bg-zinc-100" style={{ width: '100%', maxWidth: size, aspectRatio: '1/1' }} />;
  }
  return (
    <m.img
      key={text + fgColor + bgColor + logoUrl}
      layoutId={reduce ? undefined : 'qr-preview'}
      src={dataUrl}
      alt="QR code preview"
      className="aspect-square h-auto w-full rounded-xl border border-zinc-200 shadow-[0_18px_40px_-22px_var(--mt-accent-glow)]"
      style={{ maxWidth: size }}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 280, damping: 24 }}
    />
  );
}

function MiniQr({ text }: { text: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(text, { errorCorrectionLevel: 'M', margin: 1, width: 240 })
      .then((u) => { if (active) setDataUrl(u); })
      .catch(() => {});
    return () => { active = false; };
  }, [text]);
  if (!dataUrl) return <div className="aspect-square w-full animate-pulse rounded-lg bg-zinc-100" />;
  return (
    <m.img
      layout
      src={dataUrl}
      alt="QR"
      className="aspect-square w-full rounded-lg border border-zinc-100"
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
    />
  );
}

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex h-6 items-end gap-[2px]">
      {data.map((v, i) => (
        <span
          key={i}
          className="w-[3px] rounded-sm"
          style={{ height: `${(v / max) * 100}%`, background: 'var(--mt-accent)', opacity: 0.4 + (i / data.length) * 0.6 }}
        />
      ))}
    </div>
  );
}

export default function QrCodesPage() {
  const reduce = useReducedMotion();
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const [isPending, startTransition] = useTransition();
  const [qrCodes, setQrCodes] = useState<QrCodeRow[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [newMessage, setNewMessage] = useState('');

  const [editing, setEditing] = useState<QrCodeRow | null>(null);
  const [editMessage, setEditMessage] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<QrCodeRow | null>(null);
  const [downloadTarget, setDownloadTarget] = useState<QrCodeRow | null>(null);

  const [qrFg, setQrFg] = useState('#0a0a0a');
  const [qrBg, setQrBg] = useState('#ffffff');
  const [qrLogo, setQrLogo] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');

  const selectedPhoneId = activeProject?.phoneNumbers?.[0]?.id;

  const fetchQrCodes = useCallback(() => {
    if (!activeProject?._id || !selectedPhoneId) return;
    startTransition(async () => {
      const result = await getQrCodes(activeProject._id.toString(), selectedPhoneId);
      if (result.error) toast({ title: 'Error', description: result.error, variant: 'destructive' });
      else setQrCodes(result.qrCodes as QrCodeRow[]);
    });
  }, [activeProject?._id, selectedPhoneId, toast]);

  useEffect(() => { fetchQrCodes(); }, [fetchQrCodes]);

  const handleCreate = () => {
    if (!activeProject?._id || !selectedPhoneId || !newMessage.trim()) return;
    startTransition(async () => {
      const result = await handleCreateQrCode(activeProject._id.toString(), selectedPhoneId, newMessage);
      if (result.error) toast({ title: 'Error', description: result.error, variant: 'destructive' });
      else { toast({ title: 'QR code created', description: 'Your QR code is ready.' }); setNewMessage(''); setCreateOpen(false); fetchQrCodes(); }
    });
  };

  const handleUpdate = () => {
    if (!activeProject?._id || !editing || !editMessage.trim() || !selectedPhoneId) return;
    startTransition(async () => {
      const result = await handleUpdateQrCode(activeProject._id.toString(), selectedPhoneId, editing.code, editMessage);
      if (result.error) toast({ title: 'Error', description: result.error, variant: 'destructive' });
      else { toast({ title: 'QR code updated' }); setEditing(null); fetchQrCodes(); }
    });
  };

  const handleDelete = (target: QrCodeRow) => {
    if (!activeProject?._id || !selectedPhoneId) return;
    startTransition(async () => {
      const result = await handleDeleteQrCode(activeProject._id.toString(), selectedPhoneId, target.code);
      if (result.error) toast({ title: 'Error', description: result.error, variant: 'destructive' });
      else { toast({ title: 'QR code removed' }); setDeleteTarget(null); fetchQrCodes(); }
    });
  };

  const kpi = useMemo(() => {
    const totalScans = qrCodes.reduce((s, q) => s + mockScans(q.code), 0);
    const scansToday = qrCodes.reduce((s, q) => s + mockScansToday(q.code), 0);
    let top: QrCodeRow | null = null;
    let topCount = -1;
    for (const q of qrCodes) {
      const c = mockScans(q.code);
      if (c > topCount) { top = q; topCount = c; }
    }
    return {
      total: qrCodes.length,
      totalScans,
      scansToday,
      top,
      topCount,
      lastCreated: qrCodes[0]?.createdAt ?? null,
    };
  }, [qrCodes]);

  return (
    <WaPage>
      <PageHeader
        title="WhatsApp QR codes"
        description="Generate scannable codes that open WhatsApp with a prefilled message. Track scans, restyle them, and share anywhere."
        kicker="Wachat · tools"
        eyebrowIcon={QrCode}
        actions={
          <>
            <WaButton variant="outline" onClick={fetchQrCodes} disabled={isPending} leftIcon={RefreshCw}>Refresh</WaButton>
            <WaButton onClick={() => setCreateOpen(true)} leftIcon={Plus}>New QR</WaButton>
          </>
        }
      />

      {/* 4-tile KPI strip */}
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile label="Total QRs" value={kpi.total.toLocaleString('en-IN')} icon={QrCode} delay={0.02} />
        <MetricTile label="Scans today" value={kpi.scansToday.toLocaleString('en-IN')} icon={TrendingUp} delay={0.04} />
        <MetricTile
          label="Top performer"
          value={kpi.top ? `${kpi.topCount.toLocaleString('en-IN')}` : '0'}
          icon={BarChart3}
          delay={0.06}
        />
        <MetricTile label="All-time scans" value={kpi.totalScans.toLocaleString('en-IN')} icon={MessageSquare} delay={0.08} />
      </section>

      {isPending && qrCodes.length === 0 ? (
        <GridSkeleton />
      ) : qrCodes.length === 0 ? (
        <EmptyState
          icon={QrCode}
          title="No QR codes yet"
          description="Create your first QR so customers can scan and start a WhatsApp chat with a prefilled message."
          action={<WaButton onClick={() => setCreateOpen(true)} leftIcon={Plus}>Create QR code</WaButton>}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {qrCodes.map((qr, i) => {
              const scans = mockScans(qr.code);
              const today = mockScansToday(qr.code);
              const convRate = mockConvRate(qr.code);
              const lastScan = mockLastScan(qr.code);
              const spark = mockSparkline(qr.code);
              return (
                <m.li
                  key={qr.code}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: reduce ? 0 : 0.35, delay: reduce ? 0 : i * 0.03, ease: EASE_OUT }}
                  className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-3.5 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-[2px]"
                  style={{ boxShadow: '0 0 0 1px transparent' }}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 18px 40px -22px var(--mt-accent-glow)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 0 1px transparent'; }}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-20 shrink-0">
                      <MiniQr text={trackingUrl(qr)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[12.5px] font-semibold leading-snug text-zinc-900">{qr.prefilled_message}</p>
                      <p className="mt-1 truncate font-mono text-[10px] text-zinc-500">/r/qr/{qr.code.slice(0, 8)}</p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-zinc-100 pt-2.5">
                    <Stat label="Scans" value={scans.toLocaleString('en-IN')} />
                    <Stat label="Today" value={today.toLocaleString('en-IN')} />
                    <Stat label="To chat" value={`${convRate}%`} />
                  </div>

                  <div className="mt-2.5 flex items-center justify-between">
                    <Sparkline data={spark} />
                    <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500">
                      <Clock className="h-2.5 w-2.5" strokeWidth={2.25} /> {lastScan}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-1 border-t border-zinc-100 pt-2">
                    <IconBtn label="Edit" onClick={() => { setEditing(qr); setEditMessage(qr.prefilled_message); }}>
                      <Pencil className="h-3 w-3" strokeWidth={2.25} />
                    </IconBtn>
                    <IconBtn label="Download" onClick={() => { setDownloadTarget(qr); setQrFg('#0a0a0a'); setQrBg('#ffffff'); setQrLogo(''); setQrDataUrl(''); }}>
                      <Download className="h-3 w-3" strokeWidth={2.25} />
                    </IconBtn>
                    <IconBtn label="Delete" onClick={() => setDeleteTarget(qr)} danger>
                      <Trash2 className="h-3 w-3" strokeWidth={2.25} />
                    </IconBtn>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(trackingUrl(qr));
                        toast({ title: 'Copied tracking link', description: 'Link copied to clipboard.' });
                      }}
                      className="ml-auto inline-flex items-center gap-1 text-[10.5px] font-semibold text-zinc-600 transition-colors hover:text-zinc-900"
                    >
                      <Copy className="h-2.5 w-2.5" strokeWidth={2.25} />
                      Copy
                    </button>
                  </div>
                </m.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      {/* Create */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Generate QR code</ZoruDialogTitle>
            <ZoruDialogDescription>
              Set the prefilled message that appears in WhatsApp when someone scans this QR. A trackable deep link is generated automatically.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qr-message">Prefilled message</Label>
            <Textarea
              id="qr-message"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Hi, I would like to know more about..."
              rows={3}
            />
          </div>
          <ZoruDialogFooter>
            <WaButton variant="outline" onClick={() => { setCreateOpen(false); setNewMessage(''); }}>Cancel</WaButton>
            <WaButton onClick={handleCreate} disabled={isPending || !newMessage.trim()}>Generate</WaButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={editing !== null} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Update QR code</ZoruDialogTitle>
            <ZoruDialogDescription>
              Change the prefilled message. The tracking URL stays the same so existing scans keep working.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qr-edit-message">Prefilled message</Label>
            <Input id="qr-edit-message" value={editMessage} onChange={(e) => setEditMessage(e.target.value)} />
          </div>
          <ZoruDialogFooter>
            <WaButton variant="outline" onClick={() => setEditing(null)}>Cancel</WaButton>
            <WaButton onClick={handleUpdate} disabled={isPending || !editMessage.trim()}>Save</WaButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* Download + style */}
      <Dialog open={downloadTarget !== null} onOpenChange={(open) => { if (!open) setDownloadTarget(null); }}>
        <ZoruDialogContent className="max-w-2xl">
          <ZoruDialogHeader>
            <ZoruDialogTitle>Download and style QR</ZoruDialogTitle>
            <ZoruDialogDescription>
              Tweak colors and add a center logo. Analytics keep tracking through the deep link.
            </ZoruDialogDescription>
          </ZoruDialogHeader>

          {downloadTarget && (
            <div className="mt-2 grid grid-cols-1 items-start gap-6 md:grid-cols-2">
              <div
                className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 p-5"
                style={{ background: 'linear-gradient(135deg, var(--mt-accent-soft), white)' }}
              >
                <ClientQrPreview
                  text={trackingUrl(downloadTarget)}
                  fgColor={qrFg}
                  bgColor={qrBg}
                  logoUrl={qrLogo}
                  size={220}
                  onDataUrlReady={setQrDataUrl}
                />
                <p className="mt-4 max-w-[220px] truncate text-center font-mono text-[11px] text-zinc-500">
                  {trackingUrl(downloadTarget)}
                </p>
              </div>

              <div className="flex flex-col gap-4">
                <ColorRow label="Foreground" value={qrFg} onChange={setQrFg} />
                <ColorRow label="Background" value={qrBg} onChange={setQrBg} />
                <div className="flex flex-col gap-1.5">
                  <Label className="flex items-center gap-1.5 text-[12px] font-semibold">
                    <ImageIcon className="h-3.5 w-3.5" strokeWidth={2.25} /> Logo URL (optional)
                  </Label>
                  <Input
                    placeholder="https://example.com/logo.png"
                    value={qrLogo}
                    onChange={(e) => setQrLogo(e.target.value)}
                    className="text-xs"
                  />
                  <span className="text-[10.5px] text-zinc-500">Must be a CORS-enabled image URL.</span>
                </div>
              </div>
            </div>
          )}

          <ZoruDialogFooter className="mt-2">
            <WaButton variant="outline" onClick={() => setDownloadTarget(null)}>Close</WaButton>
            <WaButton
              disabled={!qrDataUrl}
              leftIcon={Download}
              onClick={() => {
                if (qrDataUrl) {
                  const link = document.createElement('a');
                  link.download = `qr-code-${downloadTarget?.code || 'wa'}.png`;
                  link.href = qrDataUrl;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  toast({ title: 'Downloaded', description: 'Your QR is saved.' });
                }
              }}
            >
              Download PNG
            </WaButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* Delete */}
      <ZoruAlertDialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete this QR code?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              Existing prints stop working immediately. Scans after this point will land on a generic WhatsApp page instead of your prefilled message, and analytics for this QR will be lost.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel disabled={isPending}>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction destructive disabled={isPending} onClick={() => deleteTarget && handleDelete(deleteTarget)}>
              Delete
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </WaPage>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="text-[13px] font-semibold tabular-nums text-zinc-900">{value}</p>
    </div>
  );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[12px] font-semibold">{label}</Label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-9 cursor-pointer rounded-lg border-0 p-0"
          aria-label={`${label} color`}
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono text-xs uppercase" />
      </div>
    </div>
  );
}

function IconBtn({ children, onClick, label, danger }: { children: React.ReactNode; onClick: () => void; label: string; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`grid h-6 w-6 place-items-center rounded-full text-zinc-500 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-900 active:scale-[0.94] ${danger ? 'hover:!text-rose-600' : ''}`}
    >
      {children}
    </button>
  );
}

function GridSkeleton() {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <li key={i} className="h-[210px] animate-pulse rounded-xl border border-zinc-200 bg-white p-3.5">
          <div className="flex gap-3">
            <div className="h-20 w-20 rounded-lg bg-zinc-100" />
            <div className="flex-1">
              <div className="h-2.5 w-3/4 rounded-full bg-zinc-100" />
              <div className="mt-1.5 h-2.5 w-1/2 rounded-full bg-zinc-100" />
            </div>
          </div>
          <div className="mt-3 h-12 rounded-lg bg-zinc-100" />
        </li>
      ))}
    </ul>
  );
}
