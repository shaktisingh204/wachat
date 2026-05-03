"use client";

import * as React from "react";
import {
  AlertCircleIcon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileArchiveIcon,
  FileIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  GridIcon,
  HeadphonesIcon,
  ImageIcon,
  ListIcon,
  SearchIcon,
  SortAscIcon,
  SortDescIcon,
  Trash2Icon,
  UploadCloudIcon,
  UploadIcon,
  VideoIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useFileUpload, formatBytes, type FileMetadata } from "./use-file-upload";

// ---------- Demo initial files (safe to remove) ----------
const initialFiles: FileMetadata[] = [
  {
    name: "brochure.pdf",
    size: 528737,
    type: "application/pdf",
    url: "https://originui.com",
    id: "brochure.pdf-1744638436563-8u5xuls",
  },
  {
    name: "cover.png",
    size: 182873,
    type: "image/png",
    url: "https://originui.com",
    id: "cover.png-1744638436563-8u5xuls",
  },
  {
    name: "report.xlsx",
    size: 352873,
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    url: "https://originui.com",
    id: "report.xlsx-1744638436563-8u5xuls",
  },
];

// ---------- Types ----------
type UploadEntry = {
  id: string;
  file: File | { name: string; type: string; size: number };
  preview?: string;
};

// ---------- Utilities ----------
const isRealFile = (f: unknown): f is File =>
  typeof window !== "undefined" && typeof File !== "undefined" && f instanceof File;

const getName = (e: UploadEntry) => (isRealFile(e.file) ? e.file.name : e.file.name);
const getType = (e: UploadEntry) => (isRealFile(e.file) ? e.file.type : e.file.type || "");
const getSize = (e: UploadEntry) => (isRealFile(e.file) ? e.file.size : e.file.size ?? 0);

const getExt = (name: string) => {
  const dot = name.lastIndexOf(".");
  return dot > -1 ? name.slice(dot + 1).toLowerCase() : "";
};

const getPreviewUrl = (e: UploadEntry) => {
  return e.preview || (e as unknown as { url?: string }).url || "";
};

const niceSubtype = (mime: string) => {
  if (!mime) return "UNKNOWN";
  const parts = mime.split("/");
  return (parts[1] || parts[0] || "unknown").toUpperCase();
};

const getFileIcon = (entry: UploadEntry) => {
  const name = getName(entry);
  const type = getType(entry);
  const ext = getExt(name);

  if (
    type.includes("pdf") ||
    ext === "pdf" ||
    type.includes("word") ||
    ext === "doc" ||
    ext === "docx" ||
    type.includes("text") ||
    ext === "txt" ||
    ext === "md"
  ) {
    return <FileTextIcon className="size-4 opacity-60" aria-hidden="true" />;
  }
  if (
    type.includes("zip") ||
    type.includes("archive") ||
    ext === "zip" ||
    ext === "rar" ||
    ext === "7z" ||
    ext === "tar"
  ) {
    return <FileArchiveIcon className="size-4 opacity-60" aria-hidden="true" />;
  }
  if (
    type.includes("excel") ||
    ext === "xls" ||
    ext === "xlsx" ||
    ext === "csv"
  ) {
    return <FileSpreadsheetIcon className="size-4 opacity-60" aria-hidden="true" />;
  }
  if (type.startsWith("video/") || ["mp4", "mov", "webm", "mkv"].includes(ext)) {
    return <VideoIcon className="size-4 opacity-60" aria-hidden="true" />;
  }
  if (type.startsWith("audio/") || ["mp3", "wav", "flac", "m4a"].includes(ext)) {
    return <HeadphonesIcon className="size-4 opacity-60" aria-hidden="true" />;
  }
  if (type.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) {
    return <ImageIcon className="size-4 opacity-60" aria-hidden="true" />;
  }
  return <FileIcon className="size-4 opacity-60" aria-hidden="true" />;
};

// ---------- Component ----------
export default function FileUpload() {
  const maxSize = 20 * 1024 * 1024; // 20MB
  const maxFiles = 20;
  const [view, setView] = React.useState<"list" | "grid">("list");
  const [query, setQuery] = React.useState("");
  const [sortBy, setSortBy] = React.useState<"name" | "type" | "size">("name");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [copied, setCopied] = React.useState<string | null>(null);

  const [
    { files, isDragging, errors },
    {
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      openFileDialog,
      removeFile,
      clearFiles,
      getInputProps,
    },
  ] = useFileUpload({
    multiple: true,
    maxFiles,
    maxSize,
    initialFiles,
  });

  React.useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 1200);
    return () => clearTimeout(t);
  }, [copied]);

  const totalSize = React.useMemo(
    () => files.reduce((acc, f) => acc + getSize(f as UploadEntry), 0),
    [files]
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? files.filter((f: UploadEntry) => {
          const name = getName(f).toLowerCase();
          const type = getType(f).toLowerCase();
          const ext = getExt(name);
          return name.includes(q) || type.includes(q) || ext.includes(q);
        })
      : files;

    const sorter = (a: UploadEntry, b: UploadEntry) => {
      let cmp = 0;
      if (sortBy === "name") {
        cmp = getName(a).localeCompare(getName(b));
      } else if (sortBy === "type") {
        cmp = getType(a).localeCompare(getType(b));
      } else {
        cmp = getSize(a) - getSize(b);
      }
      return sortDir === "asc" ? cmp : -cmp;
    };

    return [...base].sort(sorter);
  }, [files, query, sortBy, sortDir]);

  const allSelected = selected.size > 0 && filtered.every((f) => selected.has(f.id));
  const noneSelected = selected.size === 0;

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  const toggleAll = () =>
    setSelected((prev) => {
      if (filtered.length === 0) return prev;
      const everySelected = filtered.every((f) => prev.has(f.id));
      if (everySelected) return new Set();
      return new Set(filtered.map((f) => f.id));
    });

  const removeSelected = () => {
    filtered.forEach((f) => {
      if (selected.has(f.id)) removeFile(f.id);
    });
    setSelected(new Set());
  };

  const downloadOne = (entry: UploadEntry) => {
    const url = getPreviewUrl(entry);
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const downloadSelected = () => {
    filtered.forEach((f) => {
      if (selected.has(f.id)) downloadOne(f as UploadEntry);
    });
  };

  const copyLink = async (entry: UploadEntry) => {
    const url = getPreviewUrl(entry);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(entry.id);
    } catch {
      // noop
    }
  };

  return (
    <div className="flex flex-col gap-3 max-w-4xl mx-auto">
      {/* Top toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium">
            Files <span className="text-muted-foreground">({files.length})</span>
          </h3>
          <span className="text-muted-foreground text-xs">
            Total: {formatBytes(totalSize)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, type, or extension..."
              className="bg-background ring-offset-background focus-visible:ring-ring placeholder:text-muted-foreground h-8 w-56 rounded-md px-7 text-[13px] outline-none focus-visible:ring-[2px] shadow-sm"
              aria-label="Search files"
            />
            <SearchIcon
              className="text-muted-foreground pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 opacity-70"
              aria-hidden="true"
            />
          </div>

          <div className="flex items-center gap-1">
            <label htmlFor="sortby" className="text-muted-foreground sr-only">
              Sort by
            </label>
            <select
              id="sortby"
              className="bg-background h-8 rounded-md px-2 text-[13px] shadow-sm"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              aria-label="Sort files"
            >
              <option value="name">Name</option>
              <option value="type">Type</option>
              <option value="size">Size</option>
            </select>

            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
              aria-label={`Toggle sort direction to ${sortDir === "asc" ? "descending" : "ascending"}`}
            >
              {sortDir === "asc" ? (
                <SortAscIcon className="size-4" />
              ) : (
                <SortDescIcon className="size-4" />
              )}
            </Button>
          </div>

          <div className="ms-1 flex items-center gap-1">
            <Button
              variant={view === "list" ? "default" : "outline"}
              size="icon"
              className="size-8"
              onClick={() => setView("list")}
              aria-pressed={view === "list"}
              aria-label="List view"
              title="List view"
            >
              <ListIcon className="size-4" />
            </Button>
            <Button
              variant={view === "grid" ? "default" : "outline"}
              size="icon"
              className="size-8"
              onClick={() => setView("grid")}
              aria-pressed={view === "grid"}
              aria-label="Grid view"
              title="Grid view"
            >
              <GridIcon className="size-4" />
            </Button>
          </div>

          <div className="ms-2 hidden sm:flex gap-2">
            <Button variant="outline" size="sm" onClick={openFileDialog}>
              <UploadCloudIcon className="-ms-0.5 size-3.5 opacity-60" aria-hidden="true" />
              Add files
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearFiles}
              disabled={files.length === 0}
            >
              <Trash2Icon className="-ms-0.5 size-3.5 opacity-60" aria-hidden="true" />
              Remove all
            </Button>
          </div>
        </div>
      </div>

      {/* Drop area */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        data-dragging={isDragging || undefined}
        className="bg-card data-[dragging=true]:bg-accent/50 has-[input:focus]:ring-ring/50 rounded-xl border border-dashed border-border p-3 transition-colors has-[input:focus]:ring-[3px] shadow-sm"
        aria-label="Drop files here or use the select button to upload"
      >
        <input
          {...getInputProps({
            "aria-label": "Upload files",
          })}
          className="sr-only"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="bg-background me-1 flex size-9 shrink-0 items-center justify-center rounded-full shadow-sm">
              <FileIcon className="size-4 opacity-60" aria-hidden="true" />
            </div>
            <div className="text-xs">
              <p className="font-medium">Drop files to upload</p>
              <p className="text-muted-foreground">
                Up to {maxFiles} files · {formatBytes(maxSize)} per file
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={openFileDialog}>
            <UploadIcon className="-ms-1 size-3.5 opacity-60" aria-hidden="true" />
            Select files
          </Button>
        </div>
      </div>

      {filtered.length > 0 ? (
        <>
          {/* Bulk actions bar */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[13px]">
              <label className="inline-flex cursor-pointer items-center gap-1">
                <input
                  type="checkbox"
                  className="accent-foreground size-3.5"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label={allSelected ? "Unselect all" : "Select all"}
                />
                <span className="text-muted-foreground">
                  {selected.size}/{filtered.length} selected
                </span>
              </label>
              {!noneSelected && (
                <span className="text-muted-foreground hidden sm:inline">
                  • {formatBytes(
                    filtered
                      .filter((f) => selected.has(f.id))
                      .reduce((acc, f) => acc + getSize(f as UploadEntry), 0)
                  )}{" "}
                  total
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={downloadSelected}
                disabled={noneSelected}
                aria-disabled={noneSelected}
                title={noneSelected ? "Select files to download" : "Download selected"}
              >
                <DownloadIcon className="-ms-0.5 size-3.5 opacity-60" aria-hidden="true" />
                Download selected
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={removeSelected}
                disabled={noneSelected}
                aria-disabled={noneSelected}
                title={noneSelected ? "Select files to remove" : "Remove selected"}
              >
                <Trash2Icon className="-ms-0.5 size-3.5 opacity-60" aria-hidden="true" />
                Remove selected
              </Button>
            </div>
          </div>

          {view === "list" ? (
            <div className="bg-card overflow-hidden rounded-md shadow-sm">
              <Table>
                <TableHeader className="text-xs">
                  <TableRow className="bg-muted/50">
                    <TableHead className="h-9 w-10 py-2">
                      <span className="sr-only">Select</span>
                    </TableHead>
                    <TableHead className="h-9 py-2">Name</TableHead>
                    <TableHead className="h-9 py-2">Type</TableHead>
                    <TableHead className="h-9 py-2">Size</TableHead>
                    <TableHead className="h-9 w-0 py-2 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-[13px]">
                  {filtered.map((entry: UploadEntry) => {
                    const name = getName(entry);
                    const type = getType(entry);
                    const size = getSize(entry);
                    const url = getPreviewUrl(entry);
                    const isSelected = selected.has(entry.id);
                    const percentOfMax = Math.min(100, Math.round((size / maxSize) * 100));

                    return (
                      <TableRow key={entry.id} data-selected={isSelected || undefined}>
                        <TableCell className="py-2">
                          <input
                            type="checkbox"
                            className="accent-foreground size-3.5"
                            checked={isSelected}
                            onChange={() => toggleOne(entry.id)}
                            aria-label={`Select ${name}`}
                          />
                        </TableCell>
                        <TableCell className="max-w-64 py-2 font-medium">
                          <span className="flex items-center gap-2">
                            <span className="shrink-0">{getFileIcon(entry)}</span>
                            <span className="truncate">{name}</span>
                          </span>
                          <div className="mt-1 h-1.5 w-44 overflow-hidden rounded bg-muted/50">
                            <div
                              className="h-full bg-foreground/60"
                              style={{ width: `${percentOfMax}%` }}
                              aria-hidden="true"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground py-2">
                          {niceSubtype(type)}
                        </TableCell>
                        <TableCell className="text-muted-foreground py-2">
                          {formatBytes(size)}
                        </TableCell>
                        <TableCell className="py-2 text-right whitespace-nowrap">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-muted-foreground/80 hover:text-foreground size-8 hover:bg-transparent"
                            aria-label={`Open ${name}`}
                            onClick={() => url && window.open(url, "_blank", "noopener,noreferrer")}
                            title="Open preview"
                          >
                            <ExternalLinkIcon className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-muted-foreground/80 hover:text-foreground size-8 hover:bg-transparent"
                            aria-label={`Download ${name}`}
                            onClick={() => downloadOne(entry)}
                            title="Download"
                          >
                            <DownloadIcon className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-muted-foreground/80 hover:text-foreground size-8 hover:bg-transparent"
                            aria-label={`Copy link for ${name}`}
                            onClick={() => copyLink(entry)}
                            title="Copy link"
                          >
                            {copied === entry.id ? (
                              <CheckIcon className="size-4" />
                            ) : (
                              <CopyIcon className="size-4" />
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive/80 hover:text-destructive size-8 hover:bg-transparent"
                            aria-label={`Remove ${name}`}
                            onClick={() => removeFile(entry.id)}
                            title="Remove"
                          >
                            <Trash2Icon className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div
              className="bg-card grid grid-cols-2 gap-3 rounded-md p-3 sm:grid-cols-3 lg:grid-cols-4 shadow-sm"
              role="list"
              aria-label="Files grid"
            >
              {filtered.map((entry: UploadEntry) => {
                const name = getName(entry);
                const type = getType(entry);
                const size = getSize(entry);
                const url = getPreviewUrl(entry);
                const isImage = type.startsWith("image/");
                const isSelected = selected.has(entry.id);

                return (
                  <div
                    key={entry.id}
                    role="listitem"
                    className="data-[selected=true]:ring-ring/60 group relative flex flex-col overflow-hidden rounded-md bg-background shadow-sm"
                    data-selected={isSelected || undefined}
                  >
                    <label className="bg-background/80 absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded px-1.5 py-1">
                      <input
                        type="checkbox"
                        className="accent-foreground size-3.5"
                        checked={isSelected}
                        onChange={() => toggleOne(entry.id)}
                        aria-label={`Select ${name}`}
                      />
                    </label>

                    <div className="relative h-28 w-full overflow-hidden bg-muted/40">
                      {isImage && url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={url}
                          alt={name}
                          className="h-full w-full object-cover"
                          draggable={false}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          {getFileIcon(entry)}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col gap-1 p-2">
                      <div className="truncate text-[13px] font-medium" title={name}>
                        {name}
                      </div>
                      <div className="text-muted-foreground text-[12px]">
                        {niceSubtype(type)} · {formatBytes(size)}
                      </div>
                      <div className="mt-auto flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          aria-label={`Open ${name}`}
                          onClick={() => url && window.open(url, "_blank", "noopener,noreferrer")}
                          title="Open"
                        >
                          <ExternalLinkIcon className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          aria-label={`Download ${name}`}
                          onClick={() => downloadOne(entry)}
                          title="Download"
                        >
                          <DownloadIcon className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          aria-label={`Copy link for ${name}`}
                          onClick={() => copyLink(entry)}
                          title="Copy link"
                        >
                          {copied === entry.id ? (
                            <CheckIcon className="size-4" />
                          ) : (
                            <CopyIcon className="size-4" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive/80 hover:text-destructive size-8 hover:bg-transparent"
                          aria-label={`Remove ${name}`}
                          onClick={() => removeFile(entry.id)}
                          title="Remove"
                        >
                          <Trash2Icon className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <p className="text-muted-foreground text-center text-sm">
          {files.length === 0 ? "No files yet. Add or drop files above." : "No files match your search."}
        </p>
      )}

      {errors.length > 0 && (
        <div
          className="text-destructive flex items-center gap-1 text-xs"
          role="alert"
          aria-live="assertive"
        >
          <AlertCircleIcon className="size-3 shrink-0" />
          <span>{errors[0]}</span>
        </div>
      )}
    </div>
  );
}
