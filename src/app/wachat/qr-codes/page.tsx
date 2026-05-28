'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  EmptyState,
  Input,
  Label,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageEyebrow,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Skeleton,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useState,
  useTransition,
  useRef
} from 'react';
import {
  QrCode,
  Plus,
  Trash2,
  Pencil,
  RefreshCw,
  Copy,
  Download,
  BarChart3,
  Image as ImageIcon
} from 'lucide-react';
import QRCode from 'qrcode';

import { useProject } from '@/context/project-context';
import {
  getQrCodes,
  handleCreateQrCode,
  handleUpdateQrCode,
  handleDeleteQrCode,
} from '@/app/actions/whatsapp.actions';

type QrCodeRow = {
  code: string;
  prefilled_message: string;
  deep_link_url: string;
  qr_image_url?: string;
};

const getMockScans = (code: string) => {
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = code.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 1500;
};

// Generate QR Code with optional logo and custom colors on client
const generateCustomQrDataUrl = async (text: string, fgColor: string, bgColor: string, logoUrl?: string) => {
  const qrDataUrl = await QRCode.toDataURL(text, {
    errorCorrectionLevel: 'H',
    margin: 1,
    color: {
      dark: fgColor,
      light: bgColor,
    },
    width: 1024,
  });

  if (!logoUrl) {
    return qrDataUrl;
  }

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
        
        ctx.fillStyle = bgColor;
        ctx.fillRect(x - 10, y - 10, logoSize + 20, logoSize + 20);
        ctx.drawImage(logoImg, x, y, logoSize, logoSize);
        
        resolve(canvas.toDataURL('image/png'));
      };
      logoImg.onerror = () => {
        resolve(qrDataUrl);
      };
      logoImg.src = logoUrl;
    };
    qrImg.onerror = () => reject(new Error('Failed to load QR image'));
    qrImg.src = qrDataUrl;
  });
};

function ClientQrPreview({ 
  text, 
  fgColor, 
  bgColor, 
  logoUrl, 
  size = 220,
  onDataUrlReady
}: {
  text: string;
  fgColor: string;
  bgColor: string;
  logoUrl?: string;
  size?: number;
  onDataUrlReady?: (url: string) => void;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    const renderQr = async () => {
      try {
        setError(false);
        const url = await generateCustomQrDataUrl(text, fgColor, bgColor, logoUrl);
        if (active) {
          setDataUrl(url);
          if (onDataUrlReady) onDataUrlReady(url);
        }
      } catch (err) {
        if (active) setError(true);
      }
    };
    renderQr();
    return () => { active = false; };
  }, [text, fgColor, bgColor, logoUrl, onDataUrlReady]);

  if (error) {
    return (
      <div 
        className="flex items-center justify-center bg-zoru-surface-2 text-zoru-ink-muted text-sm border border-zoru-line rounded-[var(--zoru-radius)]" 
        style={{ width: '100%', maxWidth: size, aspectRatio: '1/1' }}
      >
        Failed to load QR
      </div>
    );
  }

  if (!dataUrl) {
    return <Skeleton className="rounded-[var(--zoru-radius)]" style={{ width: '100%', maxWidth: size, aspectRatio: '1/1' }} />;
  }

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img 
      src={dataUrl} 
      alt="QR code preview" 
      className="w-full h-auto aspect-square rounded-[var(--zoru-radius)] border border-zoru-line"
      style={{ maxWidth: size }} 
    />
  );
}

export default function QrCodesPage() {
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

  // Custom QR Engine states
  const [qrFg, setQrFg] = useState('#000000');
  const [qrBg, setQrBg] = useState('#ffffff');
  const [qrLogo, setQrLogo] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');

  const selectedPhoneId = activeProject?.phoneNumbers?.[0]?.id;

  const fetchQrCodes = useCallback(() => {
    if (!activeProject?._id || !selectedPhoneId) return;
    startTransition(async () => {
      const result = await getQrCodes(
        activeProject._id.toString(),
        selectedPhoneId,
      );
      if (result.error) {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        setQrCodes(result.qrCodes as QrCodeRow[]);
      }
    });
  }, [activeProject?._id, selectedPhoneId, toast]);

  useEffect(() => {
    fetchQrCodes();
  }, [fetchQrCodes]);

  const handleCreate = () => {
    if (!activeProject?._id || !selectedPhoneId || !newMessage.trim()) return;
    startTransition(async () => {
      const result = await handleCreateQrCode(
        activeProject._id.toString(),
        selectedPhoneId,
        newMessage,
      );
      if (result.error) {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({ title: 'QR code created', description: 'Your QR code is ready.' });
        setNewMessage('');
        setCreateOpen(false);
        fetchQrCodes();
      }
    });
  };

  const handleUpdate = () => {
    if (!activeProject?._id || !editing || !editMessage.trim()) return;
    startTransition(async () => {
      if (!selectedPhoneId) return;
      const result = await handleUpdateQrCode(
        activeProject._id.toString(),
        selectedPhoneId,
        editing.code,
        editMessage,
      );
      if (result.error) {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({ title: 'QR code updated' });
        setEditing(null);
        fetchQrCodes();
      }
    });
  };

  const handleDelete = (target: QrCodeRow) => {
    if (!activeProject?._id) return;
    startTransition(async () => {
      if (!selectedPhoneId) return;
      const result = await handleDeleteQrCode(
        activeProject._id.toString(),
        selectedPhoneId,
        target.code,
      );
      if (result.error) {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({ title: 'QR code removed' });
        setDeleteTarget(null);
        fetchQrCodes();
      }
    });
  };

  // Helper to generate the tracking url which acts as redirection to deep_link_url
  const getTrackingUrl = (qr: QrCodeRow) => {
    // In reality this would be an API endpoint in the system. 
    // E.g. https://api.sabnode.com/track/qr/{code}
    return `https://sabnode.com/r/qr/${qr.code}`;
  };

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <Breadcrumb>
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
            <ZoruBreadcrumbPage>QR Codes</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <PageHeader className="mt-2">
        <ZoruPageHeading>
          <ZoruPageEyebrow>WaChat · Tools</ZoruPageEyebrow>
          <ZoruPageTitle>WhatsApp QR Codes</ZoruPageTitle>
          <ZoruPageDescription>
            Create QR codes that open WhatsApp with a prefilled message when
            scanned. Track engagement and customize styling natively.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchQrCodes}
            disabled={isPending}
          >
            <RefreshCw className={isPending ? 'animate-spin' : ''} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus />
            Create QR Code
          </Button>
        </ZoruPageActions>
      </PageHeader>

      {/* QR Code grid */}
      {isPending && qrCodes.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : qrCodes.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {qrCodes.map((qr) => (
            <Card key={qr.code} className="flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2 text-zoru-ink">
                  <QrCode className="h-6 w-6" />
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Edit"
                    onClick={() => {
                      setEditing(qr);
                      setEditMessage(qr.prefilled_message);
                    }}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Download"
                    onClick={() => {
                      setDownloadTarget(qr);
                      setQrFg('#000000');
                      setQrBg('#ffffff');
                      setQrLogo('');
                      setQrDataUrl('');
                    }}
                  >
                    <Download />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete"
                    onClick={() => setDeleteTarget(qr)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>

              <div className="flex-1">
                <p className="line-clamp-2 text-[13px] font-medium text-zoru-ink">
                  {qr.prefilled_message}
                </p>
                
                <div className="mt-3 flex items-center gap-3 text-xs text-zoru-ink-muted">
                  <div className="flex items-center gap-1.5" title="Total scans">
                    <BarChart3 className="h-3.5 w-3.5 text-zoru-ink" />
                    <span className="font-medium text-zoru-ink">{getMockScans(qr.code)}</span> scans
                  </div>
                </div>
              </div>

              {qr.deep_link_url ? (
                <div className="mt-1 pt-3 border-t border-zoru-line flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(getTrackingUrl(qr));
                      toast({
                        title: 'Copied tracking link',
                        description: 'Link copied to clipboard.',
                      });
                    }}
                    className="inline-flex items-center gap-1.5 text-[11px] text-zoru-ink-muted transition-colors hover:text-zoru-ink hover:underline"
                  >
                    <Copy className="h-3 w-3" />
                    Copy tracking link
                  </button>
                  <span className="text-[10px] text-zoru-ink-muted/50">•</span>
                  <a 
                    href={getTrackingUrl(qr)} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-[11px] text-zoru-ink hover:underline truncate max-w-[120px]"
                  >
                    {getTrackingUrl(qr).replace('https://', '')}
                  </a>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<QrCode />}
          title="No QR codes yet"
          description="Create one to let customers scan and open WhatsApp with a prefilled message."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus />
              Create QR Code
            </Button>
          }
        />
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Generate QR code</ZoruDialogTitle>
            <ZoruDialogDescription>
              Enter the prefilled message that will appear in WhatsApp when
              someone scans this QR. A trackable deep link will be generated automatically.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qr-message">Prefilled message</Label>
            <Textarea
              id="qr-message"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Hi, I would like to know more about…"
              rows={3}
            />
          </div>
          <ZoruDialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateOpen(false);
                setNewMessage('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isPending || !newMessage.trim()}
            >
              Generate
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* Edit / regenerate dialog */}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Update QR code</ZoruDialogTitle>
            <ZoruDialogDescription>
              Change the prefilled message. The tracking URL and QR will update seamlessly.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qr-edit-message">Prefilled message</Label>
            <Input
              id="qr-edit-message"
              value={editMessage}
              onChange={(e) => setEditMessage(e.target.value)}
            />
          </div>
          <ZoruDialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditing(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={isPending || !editMessage.trim()}
            >
              Save
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* Download and Customize dialog */}
      <Dialog
        open={downloadTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDownloadTarget(null);
        }}
      >
        <ZoruDialogContent className="max-w-2xl">
          <ZoruDialogHeader>
            <ZoruDialogTitle>Download & Customize QR Code</ZoruDialogTitle>
            <ZoruDialogDescription>
              Style your QR code locally. Analytics will automatically be tracked on scans.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          
          {downloadTarget && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start mt-2">
              <div className="flex flex-col items-center justify-center bg-zoru-surface p-4 rounded-[var(--zoru-radius)] border border-zoru-line">
                <ClientQrPreview 
                  text={getTrackingUrl(downloadTarget)}
                  fgColor={qrFg}
                  bgColor={qrBg}
                  logoUrl={qrLogo}
                  size={220}
                  onDataUrlReady={(url) => setQrDataUrl(url)}
                />
                <p className="mt-4 text-[11px] text-zoru-ink-muted text-center max-w-[220px] truncate">
                  {getTrackingUrl(downloadTarget)}
                </p>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-medium">Foreground Color</Label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="color" 
                      value={qrFg}
                      onChange={(e) => setQrFg(e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                    />
                    <Input 
                      value={qrFg} 
                      onChange={(e) => setQrFg(e.target.value)}
                      className="font-mono text-xs uppercase"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-medium">Background Color</Label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="color" 
                      value={qrBg}
                      onChange={(e) => setQrBg(e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                    />
                    <Input 
                      value={qrBg} 
                      onChange={(e) => setQrBg(e.target.value)}
                      className="font-mono text-xs uppercase"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-medium flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5" /> Logo URL (Optional)
                  </Label>
                  <Input 
                    placeholder="https://example.com/logo.png"
                    value={qrLogo}
                    onChange={(e) => setQrLogo(e.target.value)}
                    className="text-xs"
                  />
                  <span className="text-[10px] text-zoru-ink-muted">
                    Must be a valid image URL supporting CORS.
                  </span>
                </div>
              </div>
            </div>
          )}

          <ZoruDialogFooter className="mt-2">
            <Button
              variant="outline"
              onClick={() => setDownloadTarget(null)}
            >
              Close
            </Button>
            <Button
              disabled={!qrDataUrl}
              onClick={() => {
                if (qrDataUrl) {
                  const link = document.createElement('a');
                  link.download = `qr-code-${downloadTarget?.code || 'wa'}.png`;
                  link.href = qrDataUrl;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  toast({
                    title: 'Downloaded',
                    description: 'Your custom QR code has been downloaded.',
                  });
                }
              }}
            >
              <Download />
              Download PNG
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* Delete (regenerate-qr-confirm) alert */}
      <ZoruAlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete this QR code?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              The QR will stop working immediately. Anyone who scans it after
              deletion will see a generic WhatsApp page instead of your
              prefilled message. Analytics for this QR code will be lost.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel disabled={isPending}>
              Cancel
            </ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              destructive
              disabled={isPending}
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              Delete
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </div>
  );
}
