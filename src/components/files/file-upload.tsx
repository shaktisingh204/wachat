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
  InboxIcon,
  ListIcon,
  SearchIcon,
  SortAscIcon,
  SortDescIcon,
  Trash2Icon,
  UploadCloudIcon,
  UploadIcon,
  VideoIcon,
} from "lucide-react";

import {
  Alert,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Field,
  IconButton,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TBody,
  Table,
  Td,
  Th,
  THead,
  Tr,
  useToast,
} from "@/components/sabcrm/20ui";
import { useFileUpload, formatBytes, type FileMetadata } from "./use-file-upload";

// ---------- Demo initial files (safe to remove) ----------
const initialFiles: FileMetadata[] = [
  {
    name: "brochure.pdf",
    size: 528737,
    type: "application/pdf",
    url: "https://files.sabnode.com/library/brochure.pdf",
    id: "brochure.pdf-1744638436563-8u5xuls",
  },
  {
    name: "cover.png",
    size: 182873,
    type: "image/png",
    url: "https://files.sabnode.com/library/cover.png",
    id: "cover.png-1744638436563-8u5xuls",
  },
  {
    name: "report.xlsx",
    size: 352873,
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    url: "https://files.sabnode.com/library/report.xlsx",
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
    return <FileTextIcon className="size-4 text-[var(--st-text-secondary)]" aria-hidden="true" />;
  }
  if (
    type.includes("zip") ||
    type.includes("archive") ||
    ext === "zip" ||
    ext === "rar" ||
    ext === "7z" ||
    ext === "tar"
  ) {
    return <FileArchiveIcon className="size-4 text-[var(--st-text-secondary)]" aria-hidden="true" />;
  }
  if (
    type.includes("excel") ||
    ext === "xls" ||
    ext === "xlsx" ||
    ext === "csv"
  ) {
    return <FileSpreadsheetIcon className="size-4 text-[var(--st-text-secondary)]" aria-hidden="true" />;
  }
  if (type.startsWith("video/") || ["mp4", "mov", "webm", "mkv"].includes(ext)) {
    return <VideoIcon className="size-4 text-[var(--st-text-secondary)]" aria-hidden="true" />;
  }
  if (type.startsWith("audio/") || ["mp3", "wav", "flac", "m4a"].includes(ext)) {
    return <HeadphonesIcon className="size-4 text-[var(--st-text-secondary)]" aria-hidden="true" />;
  }
  if (type.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) {
    return <ImageIcon className="size-4 text-[var(--st-text-secondary)]" aria-hidden="true" />;
  }
  return <FileIcon className="size-4 text-[var(--st-text-secondary)]" aria-hidden="true" />;
};

// ---------- Component ----------
export default function FileUpload() {
  const maxSize = 20 * 1024 * 1024; // 20MB
  const maxFiles = 20;
  const { toast } = useToast();
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
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Could not copy the link");
    }
  };

  return (
    <div className="ui20 flex flex-col gap-3 max-w-4xl mx-auto">
      {/* Top toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-[var(--st-text)]">
            Files <span className="text-[var(--st-text-secondary)]">({files.length})</span>
          </h3>
          <span className="text-[var(--st-text-secondary)] text-xs">
            Total: {formatBytes(totalSize)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-56">
            <Field>
              <Input
                inputSize="sm"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, type, or extension..."
                iconLeft={SearchIcon}
                aria-label="Search files"
              />
            </Field>
          </div>

          <div className="flex items-center gap-1">
            <Select
              value={sortBy}
              onValueChange={(v) => setSortBy(v as typeof sortBy)}
            >
              <SelectTrigger aria-label="Sort files" className="h-8 w-28">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="type">Type</SelectItem>
                <SelectItem value="size">Size</SelectItem>
              </SelectContent>
            </Select>

            <IconButton
              variant="outline"
              icon={sortDir === "asc" ? SortAscIcon : SortDescIcon}
              onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
              label={`Toggle sort direction to ${sortDir === "asc" ? "descending" : "ascending"}`}
            />
          </div>

          <div className="ms-1 flex items-center gap-1">
            <IconButton
              variant={view === "list" ? "primary" : "outline"}
              icon={ListIcon}
              onClick={() => setView("list")}
              aria-pressed={view === "list"}
              label="List view"
            />
            <IconButton
              variant={view === "grid" ? "primary" : "outline"}
              icon={GridIcon}
              onClick={() => setView("grid")}
              aria-pressed={view === "grid"}
              label="Grid view"
            />
          </div>

          <div className="ms-2 hidden sm:flex gap-2">
            <Button variant="outline" size="sm" iconLeft={UploadCloudIcon} onClick={openFileDialog}>
              Add files
            </Button>
            <Button
              variant="outline"
              size="sm"
              iconLeft={Trash2Icon}
              onClick={clearFiles}
              disabled={files.length === 0}
            >
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
        className="bg-[var(--st-bg-secondary)] data-[dragging=true]:bg-[var(--st-bg-tertiary)] rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] p-3 transition-colors"
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
            <div className="bg-[var(--st-bg)] border border-[var(--st-border)] me-1 flex size-9 shrink-0 items-center justify-center rounded-full">
              <FileIcon className="size-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
            </div>
            <div className="text-xs">
              <p className="font-medium text-[var(--st-text)]">Drop files to upload</p>
              <p className="text-[var(--st-text-secondary)]">
                Up to {maxFiles} files, {formatBytes(maxSize)} per file
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" iconLeft={UploadIcon} onClick={openFileDialog}>
            Select files
          </Button>
        </div>
      </div>

      {filtered.length > 0 ? (
        <>
          {/* Bulk actions bar */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[13px]">
              <Checkbox
                size="sm"
                checked={allSelected}
                onChange={toggleAll}
                aria-label={allSelected ? "Unselect all" : "Select all"}
              />
              <span className="text-[var(--st-text-secondary)]">
                {selected.size}/{filtered.length} selected
              </span>
              {!noneSelected && (
                <span className="text-[var(--st-text-secondary)] hidden sm:inline">
                  ,{" "}
                  {formatBytes(
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
                iconLeft={DownloadIcon}
                onClick={downloadSelected}
                disabled={noneSelected}
                aria-disabled={noneSelected}
                title={noneSelected ? "Select files to download" : "Download selected"}
              >
                Download selected
              </Button>
              <Button
                variant="outline"
                size="sm"
                iconLeft={Trash2Icon}
                onClick={removeSelected}
                disabled={noneSelected}
                aria-disabled={noneSelected}
                title={noneSelected ? "Select files to remove" : "Remove selected"}
              >
                Remove selected
              </Button>
            </div>
          </div>

          {view === "list" ? (
            <div className="bg-[var(--st-bg-secondary)] overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)]">
              <Table density="compact">
                <THead>
                  <Tr>
                    <Th width={40}>
                      <span className="sr-only">Select</span>
                    </Th>
                    <Th>Name</Th>
                    <Th>Type</Th>
                    <Th>Size</Th>
                    <Th align="right">Actions</Th>
                  </Tr>
                </THead>
                <TBody>
                  {filtered.map((entry: UploadEntry) => {
                    const name = getName(entry);
                    const type = getType(entry);
                    const size = getSize(entry);
                    const url = getPreviewUrl(entry);
                    const isSelected = selected.has(entry.id);
                    const percentOfMax = Math.min(100, Math.round((size / maxSize) * 100));

                    return (
                      <Tr key={entry.id} selected={isSelected}>
                        <Td>
                          <Checkbox
                            size="sm"
                            checked={isSelected}
                            onChange={() => toggleOne(entry.id)}
                            aria-label={`Select ${name}`}
                          />
                        </Td>
                        <Td className="max-w-64 font-medium">
                          <span className="flex items-center gap-2">
                            <span className="shrink-0">{getFileIcon(entry)}</span>
                            <span className="truncate text-[var(--st-text)]">{name}</span>
                          </span>
                          <div className="mt-1 h-1.5 w-44 overflow-hidden rounded bg-[var(--st-bg-tertiary)]">
                            <div
                              className="h-full bg-[var(--st-accent)]"
                              style={{ width: `${percentOfMax}%` }}
                              aria-hidden="true"
                            />
                          </div>
                        </Td>
                        <Td className="text-[var(--st-text-secondary)]">
                          {niceSubtype(type)}
                        </Td>
                        <Td className="text-[var(--st-text-secondary)]">
                          {formatBytes(size)}
                        </Td>
                        <Td align="right" className="whitespace-nowrap">
                          <span className="inline-flex items-center justify-end gap-1">
                            <IconButton
                              size="sm"
                              variant="ghost"
                              icon={ExternalLinkIcon}
                              label={`Open ${name}`}
                              onClick={() => url && window.open(url, "_blank", "noopener,noreferrer")}
                            />
                            <IconButton
                              size="sm"
                              variant="ghost"
                              icon={DownloadIcon}
                              label={`Download ${name}`}
                              onClick={() => downloadOne(entry)}
                            />
                            <IconButton
                              size="sm"
                              variant="ghost"
                              icon={copied === entry.id ? CheckIcon : CopyIcon}
                              label={`Copy link for ${name}`}
                              onClick={() => copyLink(entry)}
                            />
                            <IconButton
                              size="sm"
                              variant="ghost"
                              icon={Trash2Icon}
                              label={`Remove ${name}`}
                              onClick={() => removeFile(entry.id)}
                            />
                          </span>
                        </Td>
                      </Tr>
                    );
                  })}
                </TBody>
              </Table>
            </div>
          ) : (
            <div
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
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
                  <Card
                    key={entry.id}
                    variant={isSelected ? "interactive" : "outlined"}
                    role="listitem"
                    className="group relative flex flex-col overflow-hidden p-0"
                  >
                    <span className="bg-[var(--st-bg-secondary)] border border-[var(--st-border)] absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-[var(--st-radius)] px-1.5 py-1">
                      <Checkbox
                        size="sm"
                        checked={isSelected}
                        onChange={() => toggleOne(entry.id)}
                        aria-label={`Select ${name}`}
                      />
                    </span>

                    <div className="relative h-28 w-full overflow-hidden bg-[var(--st-bg-tertiary)]">
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
                      <div className="truncate text-[13px] font-medium text-[var(--st-text)]" title={name}>
                        {name}
                      </div>
                      <div className="text-[var(--st-text-secondary)] text-[12px]">
                        {niceSubtype(type)}, {formatBytes(size)}
                      </div>
                      <div className="mt-auto flex items-center justify-end gap-1">
                        <IconButton
                          size="sm"
                          variant="ghost"
                          icon={ExternalLinkIcon}
                          label={`Open ${name}`}
                          onClick={() => url && window.open(url, "_blank", "noopener,noreferrer")}
                        />
                        <IconButton
                          size="sm"
                          variant="ghost"
                          icon={DownloadIcon}
                          label={`Download ${name}`}
                          onClick={() => downloadOne(entry)}
                        />
                        <IconButton
                          size="sm"
                          variant="ghost"
                          icon={copied === entry.id ? CheckIcon : CopyIcon}
                          label={`Copy link for ${name}`}
                          onClick={() => copyLink(entry)}
                        />
                        <IconButton
                          size="sm"
                          variant="ghost"
                          icon={Trash2Icon}
                          label={`Remove ${name}`}
                          onClick={() => removeFile(entry.id)}
                        />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <EmptyState
          icon={InboxIcon}
          title={files.length === 0 ? "No files yet" : "No matches"}
          description={
            files.length === 0
              ? "Add or drop files above to get started."
              : "No files match your search."
          }
        />
      )}

      {errors.length > 0 && (
        <Alert tone="danger" icon={AlertCircleIcon}>
          {errors[0]}
        </Alert>
      )}
    </div>
  );
}
