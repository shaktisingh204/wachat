"use client";

import * as React from "react";
import { Download, FolderOpen, Pencil, Share2, Star, StarOff, Trash2 } from "lucide-react";

import {
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
} from "../dropdown-menu";

import { ZoruFileDeleteDialog } from "./file-delete-dialog";
import { ZoruFileGrid } from "./file-grid";
import { ZoruFileList } from "./file-list";
import { ZoruFilePreviewDialog } from "./file-preview-dialog";
import { ZoruFileRenameDialog } from "./file-rename-dialog";
import { ZoruFileShareDialog } from "./file-share-dialog";
import { ZoruFileToolbar } from "./file-toolbar";
import { ZoruFileUploadDialog } from "./file-upload-dialog";

import type { ZoruFileEntity, ZoruFileView } from "./types";

export interface ZoruFilesPageProps {
  files: ZoruFileEntity[];
  defaultView?: ZoruFileView;
  shareUrlFor?: (file: ZoruFileEntity) => string | undefined;
  onUpload?: (files: File[]) => void;
  onRename?: (file: ZoruFileEntity, newName: string) => void;
  onDelete?: (files: ZoruFileEntity[]) => void;
  onDownload?: (file: ZoruFileEntity) => void;
  onShareInvite?: (file: ZoruFileEntity, email: string, access: "viewer" | "editor") => void;
  onCopyShareLink?: (url: string) => void;
  onNewFolder?: () => void;
  onStar?: (file: ZoruFileEntity, star: boolean) => void;
  onNavigateFolder?: (file: ZoruFileEntity) => void;
  /** Empty-state node for when there are no files. */
  empty?: React.ReactNode;
  className?: string;
}

/**
 * Composed files surface — toolbar + grid/list + 5 dialogs (preview,
 * rename, delete, share, upload). Drop into any page that needs a
 * file browser; pass handlers to wire it to your storage layer.
 */
export function ZoruFilesPage({
  files,
  defaultView = "grid",
  shareUrlFor,
  onUpload,
  onRename,
  onDelete,
  onDownload,
  onShareInvite,
  onCopyShareLink,
  onNewFolder,
  onStar,
  onNavigateFolder,
  empty,
  className,
}: ZoruFilesPageProps) {
  const [view, setView] = React.useState<ZoruFileView>(defaultView);
  const [query, setQuery] = React.useState("");

  const [previewFile, setPreviewFile] = React.useState<ZoruFileEntity | null>(null);
  const [renameFile, setRenameFile] = React.useState<ZoruFileEntity | null>(null);
  const [shareFile, setShareFile] = React.useState<ZoruFileEntity | null>(null);
  const [deleteFiles, setDeleteFiles] = React.useState<ZoruFileEntity[] | null>(null);
  const [uploadOpen, setUploadOpen] = React.useState(false);

  const [actionTarget, setActionTarget] = React.useState<ZoruFileEntity | null>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);

  const filtered = React.useMemo(() => {
    if (!query.trim()) return files;
    const q = query.toLowerCase();
    return files.filter((f) => f.name.toLowerCase().includes(q));
  }, [files, query]);

  return (
    <div className={className}>
      <div className="flex flex-col gap-4">
        <ZoruFileToolbar
          query={query}
          onQueryChange={setQuery}
          view={view}
          onViewChange={setView}
          onUpload={onUpload ? () => setUploadOpen(true) : undefined}
          onNewFolder={onNewFolder}
        />

        {view === "grid" ? (
          <ZoruFileGrid
            files={filtered}
            onOpen={(file) => {
              if (file.isFolder && onNavigateFolder) {
                onNavigateFolder(file);
              } else {
                setPreviewFile(file);
              }
            }}
            onAction={(file) => {
              setActionTarget(file);
              setMenuOpen(true);
            }}
            empty={empty}
          />
        ) : (
          <ZoruFileList
            files={filtered}
            onOpen={(file) => {
              if (file.isFolder && onNavigateFolder) {
                onNavigateFolder(file);
              } else {
                setPreviewFile(file);
              }
            }}
            onAction={(file) => {
              setActionTarget(file);
              setMenuOpen(true);
            }}
            empty={empty}
          />
        )}
      </div>

      {/* Single shared row-action menu — anchored off-screen and
          re-positioned by Radix relative to the file the user clicked. */}
      <DropdownMenu
        open={menuOpen}
        onOpenChange={(open) => {
          setMenuOpen(open);
          if (!open) setActionTarget(null);
        }}
      >
        <ZoruDropdownMenuTrigger asChild>
          <span aria-hidden className="sr-only" />
        </ZoruDropdownMenuTrigger>
        <ZoruDropdownMenuContent align="end" className="w-44">
          {actionTarget?.isFolder && onNavigateFolder && (
            <ZoruDropdownMenuItem
              onSelect={() => {
                if (actionTarget) onNavigateFolder(actionTarget);
              }}
            >
              <FolderOpen /> Open
            </ZoruDropdownMenuItem>
          )}
          <ZoruDropdownMenuItem
            onSelect={() => {
              if (actionTarget) setRenameFile(actionTarget);
            }}
            disabled={!onRename}
          >
            <Pencil /> Rename
          </ZoruDropdownMenuItem>
          {onStar && (
            <ZoruDropdownMenuItem
              onSelect={() => {
                if (actionTarget) onStar(actionTarget, !actionTarget.starred);
              }}
            >
              {actionTarget?.starred ? (
                <>
                  <StarOff /> Unstar
                </>
              ) : (
                <>
                  <Star /> Star
                </>
              )}
            </ZoruDropdownMenuItem>
          )}
          <ZoruDropdownMenuItem
            onSelect={() => {
              if (actionTarget) setShareFile(actionTarget);
            }}
          >
            <Share2 /> Share
          </ZoruDropdownMenuItem>
          {onDownload && (
            <ZoruDropdownMenuItem
              onSelect={() => {
                if (actionTarget) onDownload(actionTarget);
              }}
            >
              <Download /> Download
            </ZoruDropdownMenuItem>
          )}
          <ZoruDropdownMenuSeparator />
          <ZoruDropdownMenuItem
            destructive
            disabled={!onDelete}
            onSelect={() => {
              if (actionTarget) setDeleteFiles([actionTarget]);
            }}
          >
            <Trash2 /> Delete
          </ZoruDropdownMenuItem>
        </ZoruDropdownMenuContent>
      </DropdownMenu>

      <ZoruFilePreviewDialog
        file={previewFile}
        onOpenChange={(open) => !open && setPreviewFile(null)}
      />

      <ZoruFileRenameDialog
        file={renameFile}
        onOpenChange={(open) => !open && setRenameFile(null)}
        onRename={(file, name) => onRename?.(file, name)}
      />

      <ZoruFileShareDialog
        file={shareFile}
        shareUrl={shareFile && shareUrlFor ? shareUrlFor(shareFile) : undefined}
        onOpenChange={(open) => !open && setShareFile(null)}
        onInvite={onShareInvite}
        onCopyLink={onCopyShareLink}
      />

      <ZoruFileDeleteDialog
        files={deleteFiles}
        onOpenChange={(open) => !open && setDeleteFiles(null)}
        onConfirm={(arr) => onDelete?.(arr)}
      />

      <ZoruFileUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onFilesSelected={(arr) => onUpload?.(arr)}
      />
    </div>
  );
}
