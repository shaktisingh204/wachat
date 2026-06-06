'use client';

import { FileCardCollections, type FileCardItem } from '@/components/sabcrm/20ui';

export function AdjustmentAttachments({ attachments }: { attachments: string[] }) {
    if (!attachments || attachments.length === 0) return null;

    const items: FileCardItem[] = attachments.map((url, i) => {
        let name = url;
        try {
            const parsedUrl = new URL(url);
            name = parsedUrl.pathname.split('/').pop() || `Attachment ${i + 1}`;
        } catch {
            name = url.split('/').pop() || `Attachment ${i + 1}`;
        }
        
        const ext = name.split('.').pop()?.toLowerCase() || '';
        const mime = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) 
            ? 'image' 
            : ext === 'pdf' ? 'application/pdf' : 'text/plain';

        return {
            id: String(i),
            name: decodeURIComponent(name),
            thumbnailUrl: mime === 'image' ? url : undefined,
            mime,
        };
    });

    return (
        <FileCardCollections 
            items={items} 
            view="grid" 
            onItemClick={(item) => {
                const url = attachments[Number(item.id)];
                if (url) window.open(url, '_blank');
            }} 
        />
    );
}
