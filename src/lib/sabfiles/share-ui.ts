import type { SabfilesNode } from '@/lib/rust-client/sabfiles';

export type SharePreviewKind = 'image' | 'video' | 'audio' | 'document' | 'office' | 'file';
export type SabfilesOpenIntent = 'navigate' | 'actions';

export function getSharePreviewKind(mime?: string | null): SharePreviewKind {
    const normalized = mime?.toLowerCase() ?? '';
    if (normalized.startsWith('image/')) return 'image';
    if (normalized.startsWith('video/')) return 'video';
    if (normalized.startsWith('audio/')) return 'audio';
    if (
        normalized.includes('officedocument') ||
        normalized.includes('msword') ||
        normalized.includes('ms-excel') ||
        normalized.includes('ms-powerpoint') ||
        normalized.includes('opendocument')
    ) {
        return 'office';
    }
    if (
        normalized.includes('pdf') ||
        normalized.includes('text') ||
        normalized.includes('json') ||
        normalized.includes('xml') ||
        normalized.includes('csv')
    ) {
        return 'document';
    }
    return 'file';
}

export function formatShareFileSize(bytes?: number | null): string {
    if (bytes == null) return 'Size unavailable';
    if (bytes < 1024) return `${bytes} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let value = bytes / 1024;
    let index = 0;
    while (value >= 1024 && index < units.length - 1) {
        value /= 1024;
        index += 1;
    }
    return `${value.toFixed(value < 10 ? 1 : 0)} ${units[index]}`;
}

export function getShareFileExtension(name?: string | null): string {
    const trimmed = name?.trim();
    if (!trimmed) return 'Unknown';
    const lastDot = trimmed.lastIndexOf('.');
    if (lastDot <= 0 || lastDot === trimmed.length - 1) return 'Unknown';
    return trimmed.slice(lastDot + 1, lastDot + 13).toUpperCase();
}

export function getShareAccessLabel(passwordProtected: boolean, downloadEnabled: boolean): string {
    if (passwordProtected && downloadEnabled) return 'Password protected download';
    if (passwordProtected) return 'Password protected view';
    if (downloadEnabled) return 'Link can download';
    return 'View only link';
}

export function getSabfilesOpenIntent(node: Pick<SabfilesNode, 'type'>): SabfilesOpenIntent {
    return node.type === 'folder' ? 'navigate' : 'actions';
}
