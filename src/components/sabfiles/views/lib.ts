/**
 * Presentation helpers for the redesigned SabFiles surfaces — byte/date
 * formatting and a colourful, deterministic file-type badge (PDF/DOC/SVG/…)
 * echoing the reference design. Colours are emitted as a single accent and a
 * `color-mix`-derived tint so the chips adapt to light and dark themes.
 */
import {
    File as FileIcon,
    FileArchive,
    FileAudio,
    FileCode,
    FileImage,
    FileSpreadsheet,
    FileText,
    FileVideo,
    Folder,
    type LucideIcon,
} from 'lucide-react';

import type { SabfilesNode } from '@/lib/rust-client/sabfiles';

export function formatBytes(bytes?: number | null): string {
    if (bytes == null || Number.isNaN(bytes)) return '—';
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    const value = bytes / 1024 ** i;
    return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Short date — "Jan 5, 2026". */
export function formatDate(value?: string | null): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Long date — "Tue, 15 Aug 2023" (used in the file table, matches the reference). */
export function formatDateLong(value?: string | null): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(undefined, {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

export function fileExt(name: string): string {
    const m = /\.([a-z0-9]+)$/i.exec((name || '').trim());
    return m ? m[1]!.toLowerCase() : '';
}

export interface FileTypeBadge {
    /** Short uppercase label shown on the chip, e.g. "PDF". */
    label: string;
    Icon: LucideIcon;
    /** Saturated foreground/accent colour. The tint is derived from it. */
    color: string;
}

const EXT_COLOR: Record<string, string> = {
    pdf: '#e5484d',
    doc: '#2b6ef2',
    docx: '#2b6ef2',
    rtf: '#2b6ef2',
    txt: '#64748b',
    xls: '#1f9d55',
    xlsx: '#1f9d55',
    csv: '#1f9d55',
    ppt: '#e0701e',
    pptx: '#e0701e',
    svg: '#e0701e',
    png: '#7c3aed',
    jpg: '#7c3aed',
    jpeg: '#7c3aed',
    gif: '#7c3aed',
    webp: '#7c3aed',
    avif: '#7c3aed',
    mp4: '#c2369b',
    mov: '#c2369b',
    webm: '#c2369b',
    mkv: '#c2369b',
    mp3: '#0f9488',
    wav: '#0f9488',
    ogg: '#0f9488',
    zip: '#b0813a',
    rar: '#b0813a',
    '7z': '#b0813a',
    tar: '#b0813a',
    gz: '#b0813a',
    js: '#d9a40b',
    jsx: '#d9a40b',
    ts: '#2b6ef2',
    tsx: '#2b6ef2',
    json: '#d9a40b',
    html: '#e0701e',
    css: '#2b6ef2',
};

const DEFAULT_COLOR = '#64748b';

function iconForExt(ext: string, mime?: string): LucideIcon {
    if (mime?.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg'].includes(ext))
        return FileImage;
    if (mime?.startsWith('video/') || ['mp4', 'mov', 'webm', 'mkv'].includes(ext)) return FileVideo;
    if (mime?.startsWith('audio/') || ['mp3', 'wav', 'ogg'].includes(ext)) return FileAudio;
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return FileArchive;
    if (['xls', 'xlsx', 'csv'].includes(ext)) return FileSpreadsheet;
    if (['js', 'jsx', 'ts', 'tsx', 'json', 'html', 'css'].includes(ext)) return FileCode;
    if (mime?.includes('pdf') || mime?.startsWith('text/') || ['pdf', 'doc', 'docx', 'rtf', 'txt', 'ppt', 'pptx'].includes(ext))
        return FileText;
    return FileIcon;
}

/** Derive the colourful type badge for a node (folders get the Folder glyph). */
export function fileTypeBadge(node: Pick<SabfilesNode, 'type' | 'name' | 'mime'>): FileTypeBadge {
    if (node.type === 'folder') {
        return { label: 'Folder', Icon: Folder, color: '#2b6ef2' };
    }
    const ext = fileExt(node.name);
    const color = EXT_COLOR[ext] ?? DEFAULT_COLOR;
    const label = (ext || (node.mime?.split('/')[1] ?? 'FILE')).toUpperCase().slice(0, 4);
    return { label, Icon: iconForExt(ext, node.mime), color };
}

/** A theme-adaptive soft tint of an accent colour, for chip backgrounds. */
export function tint(color: string, pct = 14): string {
    return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}

/** Is this node renderable as an inline image thumbnail? */
export function isImageNode(node: Pick<SabfilesNode, 'mime' | 'url'>): boolean {
    return Boolean(node.mime?.startsWith('image/') && node.url);
}
