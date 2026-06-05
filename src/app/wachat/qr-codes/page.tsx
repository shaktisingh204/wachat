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
  Modal,
  Skeleton,
  Textarea,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  useCallback,
  useEffect,
  useState,
  useTransition,
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
  Image as ImageIcon,
} from 'lucide-react';
import QRCode from 'qrcode';

import WachatPage from '@/app/wachat/_components/wachat-page';
import { useProject } from '@/context/project-context';
import {
  getQrCodes,
  handleCreateQrCode,
  handleUpdateQrCode,
  handleDeleteQrCode,
} from '@/app/actions/whatsapp.actions';

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

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
        className="flex items-center justify-center text-sm"
        style={{
          width: '100%',
          maxWidth: size,
          aspectRatio: '1/1',
          background: 'var(--st-bg-secondary)',
          color: 'var(--st-text-tertiary)',
          border: '1px solid var(--st-border)',
          borderRadius: 'var(--st-radius)',
        }}
      >
        Failed to load QR
      </div>
    );
  }

  if (!dataUrl) {
    return (
      <Skeleton
        radius="var(--st-radius)"
        style={{ width: '100%', maxWidth: size, aspectRatio: '1/1' }}
      />
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={dataUrl}
      alt="QR code preview"
      className="w-full h-auto aspect-square"
      style={{
        maxWidth: size,
        borderRadius: 'var(--st-radius)',
        border: '1px solid var(--st-border)',
      }}
    />
  );
}

export default function QrCodesPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
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
          tone: 'danger',
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
          tone: 'danger',
        });
      } else {
        toast({ title: 'QR code created', description: 'Your QR code is ready.', tone: 'success' });
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
          tone: 'danger',
        });
      } else {
        toast({ title: 'QR code updated', tone: 'success' });
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
          tone: 'danger',
        });
      } else {
        toast({ title: 'QR code removed', tone: 'success' });
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
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'QR Codes' },
      ]}
      eyebrow="WaChat · Tools"
      title="WhatsApp QR Codes"
      description="Create QR codes that open WhatsApp with a prefilled message when scanned. Track engagement and customize styling natively."
      actions={
        <>
          <Button
            variant="outline"
            size="sm"
            iconLeft={RefreshCw}
            onClick={fetchQrCodes}
            disabled={isPending}
          >
            Refresh
          </Button>
          <Button variant="primary" size="sm" iconLeft={Plus} onClick={() => setCreateOpen(true)}>
            Create QR Code
          </Button>
        </>
      }
    >
      {/* QR Code grid */}
      {isPending && qrCodes.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={176} radius="var(--st-radius-lg)" />
          ))}
        </div>
      ) : qrCodes.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {qrCodes.map((qr) => (
            <Card key={qr.code} padding="lg" className="flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div
                  className="flex h-12 w-12 items-center justify-center"
                  style={{
                    borderRadius: 'var(--st-radius)',
                    background: 'var(--st-bg-secondary)',
                    color: 'var(--st-text)',
                  }}
                >
                  <QrCode className="h-6 w-6" aria-hidden="true" />
                </div>
                <div className="flex gap-1">
                  <IconButton
                    variant="ghost"
                    size="sm"
                    label="Edit"
                    icon={Pencil}
                    onClick={() => {
                      setEditing(qr);
                      setEditMessage(qr.prefilled_message);
                    }}
                  />
                  <IconButton
                    variant="ghost"
                    size="sm"
                    label="Download"
                    icon={Download}
                    onClick={() => {
                      setDownloadTarget(qr);
                      setQrFg('#000000');
                      setQrBg('#ffffff');
                      setQrLogo('');
                      setQrDataUrl('');
                    }}
                  />
                  <IconButton
                    variant="ghost"
                    size="sm"
                    label="Delete"
                    icon={Trash2}
                    onClick={() => setDeleteTarget(qr)}
                  />
                </div>
              </div>

              <div className="flex-1">
                <p
                  className="line-clamp-2 text-[13px] font-medium"
                  style={{ color: 'var(--st-text)' }}
                >
                  {qr.prefilled_message}
                </p>

                <div
                  className="mt-3 flex items-center gap-3 text-xs"
                  style={{ color: 'var(--st-text-tertiary)' }}
                >
                  <div className="flex items-center gap-1.5" title="Total scans">
                    <BarChart3 className="h-3.5 w-3.5" style={{ color: 'var(--st-text)' }} aria-hidden="true" />
                    <span className="font-medium" style={{ color: 'var(--st-text)' }}>{getMockScans(qr.code)}</span> scans
                  </div>
                </div>
              </div>

              {qr.deep_link_url ? (
                <div
                  className="mt-1 pt-3 flex items-center gap-3"
                  style={{ borderTop: '1px solid var(--st-border)' }}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    iconLeft={Copy}
                    onClick={() => {
                      navigator.clipboard.writeText(getTrackingUrl(qr));
                      toast({
                        title: 'Copied tracking link',
                        description: 'Link copied to clipboard.',
                        tone: 'success',
                      });
                    }}
                  >
                    Copy tracking link
                  </Button>
                  <span className="text-[10px]" style={{ color: 'var(--st-text-tertiary)' }} aria-hidden="true">•</span>
                  <a
                    href={getTrackingUrl(qr)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] hover:underline truncate max-w-[120px]"
                    style={{ color: 'var(--st-text)' }}
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
          icon={QrCode}
          title="No QR codes yet"
          description="Create one to let customers scan and open WhatsApp with a prefilled message."
          action={
            <Button variant="primary" iconLeft={Plus} onClick={() => setCreateOpen(true)}>
              Create QR Code
            </Button>
          }
        />
      )}

      {/* Create dialog */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Generate QR code"
        description="Enter the prefilled message that will appear in WhatsApp when someone scans this QR. A trackable deep link will be generated automatically."
        footer={
          <>
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
              variant="primary"
              onClick={handleCreate}
              disabled={isPending || !newMessage.trim()}
            >
              Generate
            </Button>
          </>
        }
      >
        <Field label="Prefilled message">
          <Textarea
            id="qr-message"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Hi, I would like to know more about…"
            rows={3}
          />
        </Field>
      </Modal>

      {/* Edit / regenerate dialog */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Update QR code"
        description="Change the prefilled message. The tracking URL and QR will update seamlessly."
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleUpdate}
              disabled={isPending || !editMessage.trim()}
            >
              Save
            </Button>
          </>
        }
      >
        <Field label="Prefilled message">
          <Input
            id="qr-edit-message"
            value={editMessage}
            onChange={(e) => setEditMessage(e.target.value)}
          />
        </Field>
      </Modal>

      {/* Download and Customize dialog */}
      <Modal
        open={downloadTarget !== null}
        onClose={() => setDownloadTarget(null)}
        size="lg"
        title="Download & Customize QR Code"
        description="Style your QR code locally. Analytics will automatically be tracked on scans."
        footer={
          <>
            <Button variant="outline" onClick={() => setDownloadTarget(null)}>
              Close
            </Button>
            <Button
              variant="primary"
              iconLeft={Download}
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
                    tone: 'success',
                  });
                }
              }}
            >
              Download PNG
            </Button>
          </>
        }
      >
        {downloadTarget && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div
              className="flex flex-col items-center justify-center p-4"
              style={{
                background: 'var(--st-bg)',
                borderRadius: 'var(--st-radius)',
                border: '1px solid var(--st-border)',
              }}
            >
              <ClientQrPreview
                text={getTrackingUrl(downloadTarget)}
                fgColor={qrFg}
                bgColor={qrBg}
                logoUrl={qrLogo}
                size={220}
                onDataUrlReady={(url) => setQrDataUrl(url)}
              />
              <p
                className="mt-4 text-[11px] text-center max-w-[220px] truncate"
                style={{ color: 'var(--st-text-tertiary)' }}
              >
                {getTrackingUrl(downloadTarget)}
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <Field label="Foreground Color">
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    aria-label="Foreground color picker"
                    value={qrFg}
                    onChange={(e) => setQrFg(e.target.value)}
                    className="w-8 h-8 cursor-pointer border-0 p-0"
                    style={{ borderRadius: 'var(--st-radius)' }}
                  />
                  <Input
                    value={qrFg}
                    onChange={(e) => setQrFg(e.target.value)}
                    className="font-mono text-xs uppercase"
                  />
                </div>
              </Field>

              <Field label="Background Color">
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    aria-label="Background color picker"
                    value={qrBg}
                    onChange={(e) => setQrBg(e.target.value)}
                    className="w-8 h-8 cursor-pointer border-0 p-0"
                    style={{ borderRadius: 'var(--st-radius)' }}
                  />
                  <Input
                    value={qrBg}
                    onChange={(e) => setQrBg(e.target.value)}
                    className="font-mono text-xs uppercase"
                  />
                </div>
              </Field>

              <Field
                label={
                  <span className="inline-flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" /> Logo URL (Optional)
                  </span>
                }
                help="Must be a valid image URL supporting CORS."
              >
                <Input
                  placeholder="https://example.com/logo.png"
                  value={qrLogo}
                  onChange={(e) => setQrLogo(e.target.value)}
                  className="text-xs"
                />
              </Field>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete (regenerate-qr-confirm) alert */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this QR code?</AlertDialogTitle>
            <AlertDialogDescription>
              The QR will stop working immediately. Anyone who scans it after
              deletion will see a generic WhatsApp page instead of your
              prefilled message. Analytics for this QR code will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              intent="danger"
              disabled={isPending}
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WachatPage>
  );
}
