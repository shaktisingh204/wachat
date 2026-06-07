"use client";

import * as React from "react";
import { Download, FolderOpen, Pencil, Share2, Star, StarOff, Trash2 } from "lucide-react";

import {
  DropdownMenu,
  SabDropdownMenuContent,
  SabDropdownMenuItem,
  SabDropdownMenuSeparator,
  SabDropdownMenuTrigger,
} from "@/components/sabcrm/20ui/composites/dropdown-menu";

import { SabFileDeleteDialog } from "./file-delete-dialog";
import { SabFileGrid } from "./file-grid";
import { SabFileList } from "./file-list";
import { SabFilePreviewDialog } from "./file-preview-dialog";
import { SabFileRenameDialog } from "./file-rename-dialog";
import { SabFileShareDialog } from "./file-share-dialog";
import { SabFileToolbar } from "./file-toolbar";
import { SabFileUploadDialog } from "./file-upload-dialog";

import type { SabFileEntity, SabFileView } from "./types";

export interface SabFilesPageProps {
  files: SabFileEntity[];
  defaultView?: SabFileView;
  shareUrlFor?: (file: SabFileEntity) => string | undefined;
  onUpload?: (files: File[]) => void;
  onRename?: (file: SabFileEntity, newName: string) => void;
  onDelete?: (files: SabFileEntity[]) => void;
  onDownload?: (file: SabFileEntity) => void;
  onShareInvite?: (file: SabFileEntity, email: string, access: "viewer" | "editor") => void;
  onCopyShareLink?: (url: string) => void;
  onNewFolder?: () => void;
  onStar?: (file: SabFileEntity, star: boolean) => void;
  onNavigateFolder?: (file: SabFileEntity) => void;
  /** Empty-state node for when there are no files. */
  empty?: React.ReactNode;
  className?: string;
}

/**
 * Composed files surface — toolbar + grid/list + 5 dialogs (preview,
 * rename, delete, share, upload). Drop into any page that needs a
 * file browser; pass handlers to wire it to your storage layer.
 */
export function SabFilesPage({
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
}: SabFilesPageProps) {
  const [view, setView] = React.useState<SabFileView>(defaultView);
  const [query, setQuery] = React.useState("");

  const [previewFile, setPreviewFile] = React.useState<SabFileEntity | null>(null);
  const [renameFile, setRenameFile] = React.useState<SabFileEntity | null>(null);
  const [shareFile, setShareFile] = React.useState<SabFileEntity | null>(null);
  const [deleteFiles, setDeleteFiles] = React.useState<SabFileEntity[] | null>(null);
  const [uploadOpen, setUploadOpen] = React.useState(false);

  const [actionTarget, setActionTarget] = React.useState<SabFileEntity | null>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);

  const filtered = React.useMemo(() => {
    if (!query.trim()) return files;
    const q = query.toLowerCase();
    return files.filter((f) => f.name.toLowerCase().includes(q));
  }, [files, query]);

  return (
    <div className={className}>
      <div className="flex flex-col gap-4">
        <SabFileToolbar
          query={query}
          onQueryChange={setQuery}
          view={view}
          onViewChange={setView}
          onUpload={onUpload ? () => setUploadOpen(true) : undefined}
          onNewFolder={onNewFolder}
        />

        {view === "grid" ? (
          <SabFileGrid
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
          <SabFileList
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
        <SabDropdownMenuTrigger asChild>
          <span aria-hidden className="sr-only" />
        </SabDropdownMenuTrigger>
        <SabDropdownMenuContent align="end" className="w-44">
          {actionTarget?.isFolder && onNavigateFolder && (
            <SabDropdownMenuItem
              onSelect={() => {
                if (actionTarget) onNavigateFolder(actionTarget);
              }}
            >
              <FolderOpen /> Open
            </SabDropdownMenuItem>
          )}
          <SabDropdownMenuItem
            onSelect={() => {
              if (actionTarget) setRenameFile(actionTarget);
            }}
            disabled={!onRename}
          >
            <Pencil /> Rename
          </SabDropdownMenuItem>
          {onStar && (
            <SabDropdownMenuItem
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
            </SabDropdownMenuItem>
          )}
          <SabDropdownMenuItem
            onSelect={() => {
              if (actionTarget) setShareFile(actionTarget);
            }}
          >
            <Share2 /> Share
          </SabDropdownMenuItem>
          {onDownload && (
            <SabDropdownMenuItem
              onSelect={() => {
                if (actionTarget) onDownload(actionTarget);
              }}
            >
              <Download /> Download
            </SabDropdownMenuItem>
          )}
          <SabDropdownMenuSeparator />
          <SabDropdownMenuItem
            destructive
            disabled={!onDelete}
            onSelect={() => {
              if (actionTarget) setDeleteFiles([actionTarget]);
            }}
          >
            <Trash2 /> Delete
          </SabDropdownMenuItem>
        </SabDropdownMenuContent>
      </DropdownMenu>

      <SabFilePreviewDialog
        file={previewFile}
        onOpenChange={(open) => !open && setPreviewFile(null)}
      />

      <SabFileRenameDialog
        file={renameFile}
        onOpenChange={(open) => !open && setRenameFile(null)}
        onRename={(file, name) => onRename?.(file, name)}
      />

      <SabFileShareDialog
        file={shareFile}
        shareUrl={shareFile && shareUrlFor ? shareUrlFor(shareFile) : undefined}
        onOpenChange={(open) => !open && setShareFile(null)}
        onInvite={onShareInvite}
        onCopyLink={onCopyShareLink}
      />

      <SabFileDeleteDialog
        files={deleteFiles}
        onOpenChange={(open) => !open && setDeleteFiles(null)}
        onConfirm={(arr) => onDelete?.(arr)}
      />

      <SabFileUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onFilesSelected={(arr) => onUpload?.(arr)}
      />
    </div>
  );
}
