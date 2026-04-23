'use client';

/**
 * Wachat QR Codes — manage WhatsApp QR codes with prefilled messages.
 */

import * as React from 'react';
import { useCallback, useEffect, useState, useTransition } from 'react';
import {
  LuQrCode,
  LuPlus,
  LuTrash2,
  LuPencil,
  LuRefreshCw,
  LuCopy,
} from 'react-icons/lu';

import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import {
  getQrCodes,
  handleCreateQrCode,
  handleUpdateQrCode,
  handleDeleteQrCode,
} from '@/app/actions/whatsapp.actions';

import { ClayBreadcrumbs, ClayButton, ClayCard } from '@/components/clay';

export const dynamic = 'force-dynamic';

type QrCode = {
  code: string;
  prefilled_message: string;
  deep_link_url: string;
  qr_image_url?: string;
};

export default function QrCodesPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [qrCodes, setQrCodes] = useState<QrCode[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMessage, setEditMessage] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const selectedPhoneId = activeProject?.phoneNumbers?.[0]?.id;

  const fetchQrCodes = useCallback(() => {
    if (!activeProject?._id || !selectedPhoneId) return;
    startTransition(async () => {
      const result = await getQrCodes(activeProject._id.toString(), selectedPhoneId);
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        setQrCodes(result.qrCodes);
      }
    });
  }, [activeProject?._id, selectedPhoneId, toast]);

  useEffect(() => {
    fetchQrCodes();
  }, [fetchQrCodes]);

  const handleCreate = () => {
    if (!activeProject?._id || !selectedPhoneId || !newMessage.trim()) return;
    startTransition(async () => {
      const result = await handleCreateQrCode(activeProject._id.toString(), selectedPhoneId, newMessage);
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'QR code created successfully.' });
        setNewMessage('');
        setShowCreate(false);
        fetchQrCodes();
      }
    });
  };

  const handleUpdate = (qrCodeId: string) => {
    if (!activeProject?._id || !editMessage.trim()) return;
    startTransition(async () => {
      const result = await handleUpdateQrCode(activeProject._id.toString(), qrCodeId, editMessage);
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'QR code updated.' });
        setEditingId(null);
        fetchQrCodes();
      }
    });
  };

  const handleDelete = (qrCodeId: string) => {
    if (!activeProject?._id) return;
    startTransition(async () => {
      const result = await handleDeleteQrCode(activeProject._id.toString(), qrCodeId);
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Deleted', description: 'QR code removed.' });
        fetchQrCodes();
      }
    });
  };

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs
        items={[
          { label: 'Wachat', href: '/home' },
          { label: activeProject?.name || 'Project', href: '/dashboard' },
          { label: 'QR Codes' },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">
            WhatsApp QR Codes
          </h1>
          <p className="mt-1.5 max-w-[720px] text-[13px] text-clay-ink-muted">
            Create QR codes that open WhatsApp with a prefilled message when scanned.
          </p>
        </div>
        <div className="flex gap-2">
          <ClayButton size="sm" variant="ghost" onClick={fetchQrCodes} disabled={isPending}>
            <LuRefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isPending ? 'animate-spin' : ''}`} />
            Refresh
          </ClayButton>
          <ClayButton size="sm" onClick={() => setShowCreate(true)}>
            <LuPlus className="mr-1.5 h-3.5 w-3.5" />
            Create QR Code
          </ClayButton>
        </div>
      </div>

      {/* Create Form */}
      {showCreate && (
        <ClayCard className="p-5">
          <h3 className="text-sm font-medium text-clay-ink mb-3">New QR Code</h3>
          <div className="flex gap-3">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Enter prefilled message..."
              className="flex-1 rounded-lg border border-clay-border bg-clay-bg px-3 py-2 text-sm text-clay-ink placeholder:text-clay-ink-muted focus:border-clay-accent focus:outline-none"
            />
            <ClayButton size="sm" onClick={handleCreate} disabled={isPending || !newMessage.trim()}>
              Create
            </ClayButton>
            <ClayButton size="sm" variant="ghost" onClick={() => { setShowCreate(false); setNewMessage(''); }}>
              Cancel
            </ClayButton>
          </div>
        </ClayCard>
      )}

      {/* QR Code List */}
      {qrCodes.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {qrCodes.map((qr) => (
            <ClayCard key={qr.code} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <LuQrCode className="h-8 w-8 text-clay-ink-muted/50" />
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      setEditingId(qr.code);
                      setEditMessage(qr.prefilled_message);
                    }}
                    className="rounded p-1.5 text-clay-ink-muted hover:bg-clay-bg-2 hover:text-clay-ink"
                  >
                    <LuPencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(qr.code)}
                    className="rounded p-1.5 text-clay-ink-muted hover:bg-red-500/10 hover:text-red-500"
                  >
                    <LuTrash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {editingId === qr.code ? (
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={editMessage}
                    onChange={(e) => setEditMessage(e.target.value)}
                    className="flex-1 rounded border border-clay-border bg-clay-bg px-2 py-1.5 text-xs text-clay-ink focus:border-clay-accent focus:outline-none"
                  />
                  <ClayButton size="sm" onClick={() => handleUpdate(qr.code)} disabled={isPending}>
                    Save
                  </ClayButton>
                  <ClayButton size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                    Cancel
                  </ClayButton>
                </div>
              ) : (
                <p className="text-xs text-clay-ink-muted line-clamp-2">{qr.prefilled_message}</p>
              )}

              {qr.deep_link_url && (
                <button
                  onClick={() => { navigator.clipboard.writeText(qr.deep_link_url); toast({ title: 'Copied', description: 'Deep link copied to clipboard.' }); }}
                  className="mt-3 flex items-center gap-1.5 text-[11px] text-clay-accent hover:underline"
                >
                  <LuCopy className="h-3 w-3" />
                  Copy link
                </button>
              )}
            </ClayCard>
          ))}
        </div>
      ) : (
        !isPending && (
          <ClayCard className="p-12 text-center">
            <LuQrCode className="mx-auto h-12 w-12 text-clay-ink-muted/30 mb-4" />
            <p className="text-sm text-clay-ink-muted">No QR codes yet. Create one to get started.</p>
          </ClayCard>
        )
      )}
    </div>
  );
}
