import type { SabfilesNode } from '@/lib/rust-client/sabfiles';

export type SharePreviewKind = 'image' | 'video' | 'document' | 'file';
export type SabfilesOpenIntent = 'navigate' | 'actions';

export function getSharePreviewKind(mime?: string | null): SharePreviewKind {
    if (mime?.startsWith('image/')) return 'image';
    if (mime?.startsWith('video/')) return 'video';
    if (mime?.includes('pdf') || mime?.includes('text')) return 'document';
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

export function getSabfilesOpenIntent(node: Pick<SabfilesNode, 'type'>): SabfilesOpenIntent {
    return node.type === 'folder' ? 'navigate' : 'actions';
}
