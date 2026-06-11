'use client';

import React from 'react';
import { FolderOpen, FileText, Link2, Plus, Copy } from 'lucide-react';

import {
  Button,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  EmptyState,
  toast,
} from '@/components/sabcrm/20ui';
import { SabFilePicker } from '@/components/sabfiles';
import {
  getContactCabinet,
  shareContactCabinet,
  noteCabinetUpload,
  type ContactCabinet,
} from '@/app/actions/sabbigin-filecabinet.actions';
import { formatDate } from '@/components/sabbigin/lib/format';

export function FileCabinetButton({
  contactId,
  size = 'sm',
}: {
  contactId: string;
  size?: 'sm' | 'md';
}) {
  const [open, setOpen] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [cabinet, setCabinet] = React.useState<ContactCabinet | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [sharing, setSharing] = React.useState(false);

  async function load() {
    setLoading(true);
    const c = await getContactCabinet(contactId);
    setCabinet(c);
    setLoading(false);
  }

  React.useEffect(() => {
    if (open) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function share() {
    setSharing(true);
    const res = await shareContactCabinet(contactId);
    setSharing(false);
    if (res.success && res.url) {
      setCabinet((c) => (c ? { ...c, shareUrl: res.url ?? null } : c));
      toast.success({ title: 'Share link ready' });
    } else {
      toast.error({ title: 'Could not create link', description: res.error });
    }
  }

  function copyShare() {
    if (!cabinet?.shareUrl) return;
    const full = cabinet.shareUrl.startsWith('http')
      ? cabinet.shareUrl
      : `${window.location.origin}${cabinet.shareUrl}`;
    void navigator.clipboard.writeText(full);
    toast.success({ title: 'Link copied' });
  }

  return (
    <>
      <Button
        variant="secondary"
        size={size}
        iconLeft={<FolderOpen size={14} />}
        onClick={() => setOpen(true)}
      >
        Files
      </Button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent side="right" className="flex w-full max-w-md flex-col">
          <DrawerHeader>
            <DrawerTitle>File cabinet</DrawerTitle>
          </DrawerHeader>

          <div className="flex items-center gap-2 border-b border-[var(--st-border)] p-3">
            <Button
              variant="primary"
              size="sm"
              iconLeft={<Plus size={14} />}
              disabled={!cabinet?.folderId}
              onClick={() => setPickerOpen(true)}
            >
              Add file
            </Button>
            <Button
              variant="secondary"
              size="sm"
              iconLeft={<Link2 size={14} />}
              loading={sharing}
              disabled={!cabinet?.folderId}
              onClick={share}
            >
              Share upload link
            </Button>
          </div>

          {cabinet?.shareUrl && (
            <div className="flex items-center gap-2 bg-[var(--st-surface-2,rgba(0,0,0,0.03))] px-3 py-2 text-xs">
              <code className="flex-1 truncate text-[var(--st-accent)]">
                {cabinet.shareUrl}
              </code>
              <button
                type="button"
                onClick={copyShare}
                className="u-icon-btn u-icon-btn--sm"
                aria-label="Copy link"
              >
                <Copy size={13} />
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-3">
            {loading ? (
              <p className="text-sm text-[var(--st-text-secondary)]">Loading…</p>
            ) : !cabinet || cabinet.files.length === 0 ? (
              <EmptyState
                icon={FileText}
                size="sm"
                title="No files yet"
                description="Add files here, or share an upload link so the customer can send documents."
              />
            ) : (
              <ul className="flex flex-col gap-1.5">
                {cabinet.files.map((f) => (
                  <li
                    key={f.id}
                    className="flex items-center gap-2 rounded-[var(--st-radius-sm)] border border-[var(--st-border)] p-2"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-[var(--st-text-secondary)]" />
                    <a
                      href={f.url ?? '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 flex-1 truncate text-sm text-[var(--st-text)] hover:text-[var(--st-accent)]"
                    >
                      {f.name}
                    </a>
                    <span className="shrink-0 text-[11px] text-[var(--st-text-secondary)]">
                      {formatDate(f.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <SabFilePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        defaultParentId={cabinet?.folderId ?? null}
        allowUpload
        title="Add to file cabinet"
        onPick={async (pick) => {
          setPickerOpen(false);
          await noteCabinetUpload(contactId, pick.name);
          await load();
          toast.success({ title: 'File added', description: pick.name });
        }}
      />
    </>
  );
}
