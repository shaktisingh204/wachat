'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function ImageMetadataPage() {
  const [data, setData] = useState<any>(null);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      setData({
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: new Date(file.lastModified).toLocaleString(),
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  };

  return (
    <ToolShell title="Image Metadata Viewer" description="Basic metadata (dimensions, size, type, last modified).">
      <input type="file" accept="image/*" onChange={onFile} className="block" />
      {data && (
        <Card><CardContent className="p-4 space-y-1 text-sm">
          <div><span className="font-semibold">Name:</span> {data.name}</div>
          <div><span className="font-semibold">Type:</span> {data.type}</div>
          <div><span className="font-semibold">Size:</span> {(data.size / 1024).toFixed(1)} KB</div>
          <div><span className="font-semibold">Dimensions:</span> {data.width}×{data.height}</div>
          <div><span className="font-semibold">Last modified:</span> {data.lastModified}</div>
          <div className="text-xs text-muted-foreground pt-2">Full EXIF support requires the `exif-js` package (not installed).</div>
        </CardContent></Card>
      )}
    </ToolShell>
  );
}
