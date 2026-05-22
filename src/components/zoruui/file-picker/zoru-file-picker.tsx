"use client";

import * as React from "react";
import { File as FileIcon, Image as ImageIcon, Loader2, Search, Upload, X } from "lucide-react";

import { cn } from "../lib/cn";
import { Button } from "../button";
import {
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
} from "../dialog";
import { Input } from "../input";
import {
  listLibraryFiles,
  uploadLibraryFile,
  type LibraryFile,
  type LibraryFileTag,
} from "@/app/actions/files.actions";

export interface ZoruFilePickerProps {
  /** Controlled open state. Pair with <ZoruFilePicker.Trigger> for uncontrolled. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Callback when a file is picked (either selected from library or freshly uploaded). */
  onPick: (file: LibraryFile) => void;
  /** Restrict to a single media kind (defaults to "all"). */
  accept?: LibraryFileTag | "all";
  title?: React.ReactNode;
  description?: React.ReactNode;
}

const TAGS: { id: LibraryFileTag | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "image", label: "Images" },
  { id: "video", label: "Video" },
  { id: "audio", label: "Audio" },
  { id: "document", label: "Documents" },
];

export function ZoruFilePicker({
  open,
  onOpenChange,
  onPick,
  accept = "all",
  title = "Pick a file",
  description = "Choose from your library or upload a new file.",
}: ZoruFilePickerProps) {
  const [tab, setTab] = React.useState<"library" | "upload">("library");
  const [tag, setTag] = React.useState<LibraryFileTag | "all">(accept);
  const [search, setSearch] = React.useState("");
  const [items, setItems] = React.useState<LibraryFile[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listLibraryFiles({
        tag: tag === "all" ? undefined : tag,
        search: search || undefined,
      });
      setItems(res.items);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load files");
    } finally {
      setLoading(false);
    }
  }, [tag, search]);

  React.useEffect(() => {
    if (!open) return;
    refresh();
  }, [open, refresh]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const created = await uploadLibraryFile(fd);
      onPick(created);
      onOpenChange(false);
    } catch (e: any) {
      setError(e?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <ZoruDialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="max-w-3xl">
        <ZoruDialogHeader>
          <ZoruDialogTitle>{title}</ZoruDialogTitle>
          <ZoruDialogDescription>{description}</ZoruDialogDescription>
        </ZoruDialogHeader>

        <div className="flex gap-1 rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-surface p-1">
          {(["library", "upload"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "flex-1 rounded-[var(--zoru-radius-sm)] px-3 py-1.5 text-sm transition-colors",
                tab === id
                  ? "bg-zoru-bg text-zoru-ink shadow-[var(--zoru-shadow-sm)]"
                  : "text-zoru-ink-muted hover:text-zoru-ink",
              )}
            >
              {id === "library" ? "Library" : "Upload"}
            </button>
          ))}
        </div>

        {tab === "library" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <ZoruInput
                  placeholder="Search by name…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  leadingSlot={<Search />}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {TAGS.filter((t) => accept === "all" || t.id === "all" || t.id === accept).map(
                  (t) => (
                    <ZoruButton
                      key={t.id}
                      size="sm"
                      variant={tag === t.id ? "default" : "outline"}
                      onClick={() => setTag(t.id)}
                    >
                      {t.label}
                    </ZoruButton>
                  ),
                )}
              </div>
            </div>

            {error && (
              <p className="text-xs text-zoru-danger-ink" role="alert">
                {error}
              </p>
            )}

            {loading ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-zoru-ink-muted" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex h-40 items-center justify-center rounded-[var(--zoru-radius)] border border-dashed border-zoru-line text-sm text-zoru-ink-muted">
                No files yet — upload your first one.
              </div>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onPick(item);
                        onOpenChange(false);
                      }}
                      className="group flex w-full flex-col gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-2 text-left transition-shadow hover:shadow-[var(--zoru-shadow-md)]"
                    >
                      <div className="aspect-square w-full overflow-hidden rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2">
                        {item.tag === "image" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.url}
                            alt={item.name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-zoru-ink-muted">
                            <FileIcon className="h-8 w-8" />
                          </div>
                        )}
                      </div>
                      <p className="truncate text-xs text-zoru-ink">{item.name}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "upload" && (
          <div>
            <UploadDropzone uploading={uploading} onFile={handleUpload} accept={accept} />
            {error && (
              <p className="mt-2 text-xs text-zoru-danger-ink" role="alert">
                {error}
              </p>
            )}
          </div>
        )}

        <ZoruDialogFooter>
          <ZoruButton variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </ZoruButton>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}

function UploadDropzone({
  uploading,
  onFile,
  accept,
}: {
  uploading: boolean;
  onFile: (file: File) => void;
  accept: LibraryFileTag | "all";
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [drag, setDrag] = React.useState(false);

  const acceptAttr =
    accept === "image"
      ? "image/*"
      : accept === "video"
        ? "video/*"
        : accept === "audio"
          ? "audio/*"
          : accept === "document"
            ? "application/pdf,application/msword,.doc,.docx,.xls,.xlsx,text/*"
            : undefined;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-[var(--zoru-radius)] border-2 border-dashed p-10 text-center",
        drag ? "border-zoru-ink bg-zoru-surface-2" : "border-zoru-line bg-zoru-surface",
      )}
    >
      <Upload className="h-6 w-6 text-zoru-ink-muted" />
      <p className="text-sm text-zoru-ink">Drag a file here or click to browse</p>
      <p className="text-xs text-zoru-ink-muted">Up to 100 MB. Stored on Cloudflare R2.</p>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={acceptAttr}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
      <ZoruButton
        size="sm"
        variant="default"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Uploading…
          </>
        ) : (
          "Choose file"
        )}
      </ZoruButton>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
 * <ZoruFileInput> — drop-in replacement for the old "paste a URL"
 * input. Renders a button-styled control showing the picked file name
 * (or a placeholder), opens the picker on click, and exposes the
 * picked URL/id via the controlled `value` / `onChange` API so it can
 * stand in wherever a string URL was being collected.
 * ────────────────────────────────────────────────────────────────── */

export interface ZoruFileInputProps {
  /** Currently picked file (preferred — gives a nicer label). */
  value?: LibraryFile | null;
  /** Called with the picked file, or null when cleared. */
  onChange: (file: LibraryFile | null) => void;
  /** Placeholder shown when nothing is picked. */
  placeholder?: string;
  accept?: LibraryFileTag | "all";
  className?: string;
  disabled?: boolean;
  /** Title forwarded to the picker dialog. */
  pickerTitle?: React.ReactNode;
}

export function ZoruFileInput({
  value,
  onChange,
  placeholder = "Pick a file",
  accept = "all",
  className,
  disabled,
  pickerTitle,
}: ZoruFileInputProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-9 w-full items-center gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg px-3 text-left text-sm text-zoru-ink transition-colors",
          "hover:bg-zoru-surface-2 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      >
        {value ? (
          value.tag === "image" ? (
            <ImageIcon className="h-4 w-4 shrink-0 text-zoru-ink-muted" />
          ) : (
            <FileIcon className="h-4 w-4 shrink-0 text-zoru-ink-muted" />
          )
        ) : (
          <Upload className="h-4 w-4 shrink-0 text-zoru-ink-muted" />
        )}
        <span className={cn("flex-1 truncate", !value && "text-zoru-ink-muted")}>
          {value?.name ?? placeholder}
        </span>
        {value && (
          <span
            role="button"
            tabIndex={0}
            aria-label="Clear file"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onChange(null);
              }
            }}
            className="rounded p-0.5 text-zoru-ink-muted hover:bg-zoru-surface-3 hover:text-zoru-ink"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        )}
      </button>
      <ZoruFilePicker
        open={open}
        onOpenChange={setOpen}
        accept={accept}
        title={pickerTitle}
        onPick={(file) => onChange(file)}
      />
    </>
  );
}
