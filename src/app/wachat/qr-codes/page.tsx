'use client';

/**
 * Wachat QR Codes (ZoruUI).
 *
 * Manage WhatsApp QR codes with prefilled messages. Grid of QR cards
 * with download / regenerate / delete dialogs.
 */

import * as React from 'react';
import { useCallback, useEffect, useState, useTransition } from 'react';
import {
  QrCode,
  Plus,
  Trash2,
  Pencil,
  RefreshCw,
  Copy,
  Download,
} from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  getQrCodes,
  handleCreateQrCode,
  handleUpdateQrCode,
  handleDeleteQrCode,
} from '@/app/actions/whatsapp.actions';

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
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruEmptyState,
  ZoruInput,
  ZoruLabel,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageEyebrow,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSkeleton,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';

export const dynamic = 'force-dynamic';

type QrCodeRow = {
  code: string;
  prefilled_message: string;
  deep_link_url: string;
  qr_image_url?: string;
};

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
      const result = await handleUpdateQrCode(
        activeProject._id.toString(),
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
      const result = await handleDeleteQrCode(
        activeProject._id.toString(),
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
            <ZoruBreadcrumbPage>QR Codes</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader className="mt-2">
        <ZoruPageHeading>
          <ZoruPageEyebrow>WaChat · Tools</ZoruPageEyebrow>
          <ZoruPageTitle>WhatsApp QR Codes</ZoruPageTitle>
          <ZoruPageDescription>
            Create QR codes that open WhatsApp with a prefilled message when
            scanned.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <ZoruButton
            variant="outline"
            size="sm"
            onClick={fetchQrCodes}
            disabled={isPending}
          >
            <RefreshCw className={isPending ? 'animate-spin' : ''} />
            Refresh
          </ZoruButton>
          <ZoruButton size="sm" onClick={() => setCreateOpen(true)}>
            <Plus />
            Create QR Code
          </ZoruButton>
        </ZoruPageActions>
      </ZoruPageHeader>

      {/* QR Code grid */}
      {isPending && qrCodes.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ZoruSkeleton key={i} className="h-44" />
          ))}
        </div>
      ) : qrCodes.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {qrCodes.map((qr) => (
            <ZoruCard key={qr.code} className="flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2 text-zoru-ink">
                  <QrCode className="h-6 w-6" />
                </div>
                <div className="flex gap-1">
                  <ZoruButton
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Edit"
                    onClick={() => {
                      setEditing(qr);
                      setEditMessage(qr.prefilled_message);
                    }}
                  >
                    <Pencil />
                  </ZoruButton>
                  <ZoruButton
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Download"
                    onClick={() => setDownloadTarget(qr)}
                  >
                    <Download />
                  </ZoruButton>
                  <ZoruButton
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete"
                    onClick={() => setDeleteTarget(qr)}
                  >
                    <Trash2 />
                  </ZoruButton>
                </div>
              </div>

              <p className="line-clamp-2 text-[12px] text-zoru-ink-muted">
                {qr.prefilled_message}
              </p>

              {qr.deep_link_url ? (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(qr.deep_link_url);
                    toast({
                      title: 'Copied',
                      description: 'Deep link copied to clipboard.',
                    });
                  }}
                  className="inline-flex items-center gap-1.5 self-start text-[11px] text-zoru-ink-muted transition-colors hover:text-zoru-ink hover:underline"
                >
                  <Copy className="h-3 w-3" />
                  Copy link
                </button>
              ) : null}
            </ZoruCard>
          ))}
        </div>
      ) : (
        <ZoruEmptyState
          icon={<QrCode />}
          title="No QR codes yet"
          description="Create one to let customers scan and open WhatsApp with a prefilled message."
          action={
            <ZoruButton onClick={() => setCreateOpen(true)}>
              <Plus />
              Create QR Code
            </ZoruButton>
          }
        />
      )}

      {/* Create dialog */}
      <ZoruDialog open={createOpen} onOpenChange={setCreateOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Generate QR code</ZoruDialogTitle>
            <ZoruDialogDescription>
              Enter the prefilled message that will appear in WhatsApp when
              someone scans this QR.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="qr-message">Prefilled message</ZoruLabel>
            <ZoruTextarea
              id="qr-message"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Hi, I would like to know more about…"
              rows={3}
            />
          </div>
          <ZoruDialogFooter>
            <ZoruButton
              variant="outline"
              onClick={() => {
                setCreateOpen(false);
                setNewMessage('');
              }}
            >
              Cancel
            </ZoruButton>
            <ZoruButton
              onClick={handleCreate}
              disabled={isPending || !newMessage.trim()}
            >
              Generate
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>

      {/* Edit / regenerate dialog */}
      <ZoruDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Update QR code</ZoruDialogTitle>
            <ZoruDialogDescription>
              Change the prefilled message. The QR image will regenerate
              automatically.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="qr-edit-message">Prefilled message</ZoruLabel>
            <ZoruInput
              id="qr-edit-message"
              value={editMessage}
              onChange={(e) => setEditMessage(e.target.value)}
            />
          </div>
          <ZoruDialogFooter>
            <ZoruButton
              variant="outline"
              onClick={() => setEditing(null)}
            >
              Cancel
            </ZoruButton>
            <ZoruButton
              onClick={handleUpdate}
              disabled={isPending || !editMessage.trim()}
            >
              Save
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>

      {/* Download dialog */}
      <ZoruDialog
        open={downloadTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDownloadTarget(null);
        }}
      >
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Download QR code</ZoruDialogTitle>
            <ZoruDialogDescription>
              Save this QR as a PNG you can print or embed.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          {downloadTarget?.qr_image_url ? (
            <div className="flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={downloadTarget.qr_image_url}
                alt="QR code preview"
                width={220}
                height={220}
                className="rounded-[var(--zoru-radius)] border border-zoru-line"
              />
            </div>
          ) : (
            <p className="text-center text-[12.5px] text-zoru-ink-muted">
              Preview not available — use the deep link below.
            </p>
          )}
          {downloadTarget?.deep_link_url ? (
            <ZoruInput
              readOnly
              value={downloadTarget.deep_link_url}
              className="font-mono text-[12px]"
            />
          ) : null}
          <ZoruDialogFooter>
            <ZoruButton
              variant="outline"
              onClick={() => setDownloadTarget(null)}
            >
              Close
            </ZoruButton>
            {downloadTarget?.qr_image_url ? (
              <ZoruButton
                onClick={() => {
                  if (downloadTarget?.qr_image_url) {
                    window.open(downloadTarget.qr_image_url, '_blank');
                  }
                }}
              >
                <Download />
                Download PNG
              </ZoruButton>
            ) : null}
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>

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
              prefilled message.
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
