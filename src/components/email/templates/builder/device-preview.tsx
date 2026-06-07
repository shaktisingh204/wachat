'use client';

/**
 * Device preview drawer. Renders compiled HTML inside a sandboxed
 * iframe so the email's own styles can't bleed into the app shell.
 * Supports desktop / mobile / dark-mode toggles.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Monitor, Moon, Smartphone, Sun } from 'lucide-react';

import {
  Alert,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  SegmentedControl,
} from '@/components/sabcrm/20ui';

type DeviceMode = 'desktop' | 'mobile';
type ColorMode = 'light' | 'dark';

export interface DevicePreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  html: string;
  warnings?: string[];
}

export function DevicePreview({
  open,
  onOpenChange,
  html,
  warnings = [],
}: DevicePreviewProps) {
  const [device, setDevice] = useState<DeviceMode>('desktop');
  const [color, setColor] = useState<ColorMode>('light');
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Compose a full HTML document so the iframe srcDoc is self-contained.
  const srcDoc = useMemo(() => {
    const bg = color === 'dark' ? '#0b0b0c' : '#f4f4f7';
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  body { margin: 0; padding: 24px; background: ${bg}; font-family: Inter, Arial, sans-serif; }
  ${color === 'dark' ? 'img { filter: brightness(0.9); }' : ''}
</style>
</head>
<body>${html}</body>
</html>`;
  }, [html, color]);

  useEffect(() => {
    if (!open) return;
    // Reset to desktop when opening.
    setDevice('desktop');
  }, [open]);

  const width = device === 'mobile' ? 390 : 720;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[88vh]">
        <DrawerHeader className="flex flex-row items-center justify-between">
          <DrawerTitle>Preview</DrawerTitle>
          <div className="flex items-center gap-2">
            <SegmentedControl
              size="sm"
              aria-label="Preview device"
              value={device}
              onChange={setDevice}
              items={[
                { value: 'desktop', label: 'Desktop', icon: Monitor },
                { value: 'mobile', label: 'Mobile', icon: Smartphone },
              ]}
            />
            <SegmentedControl
              size="sm"
              aria-label="Preview color scheme"
              value={color}
              onChange={setColor}
              items={[
                { value: 'light', label: 'Light', icon: Sun },
                { value: 'dark', label: 'Dark', icon: Moon },
              ]}
            />
          </div>
        </DrawerHeader>

        {warnings.length > 0 ? (
          <Alert tone="warning" title="Renderer warnings" className="mx-4 mb-2">
            <ul className="ml-4 list-disc">
              {warnings.map((w, i) => (
                <li key={`${w}-${i}`}>{w}</li>
              ))}
            </ul>
          </Alert>
        ) : null}

        <div className="flex h-full justify-center overflow-auto px-4 pb-6">
          <iframe
            ref={iframeRef}
            sandbox=""
            title="Email preview"
            srcDoc={srcDoc}
            className="h-full max-w-full rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]"
            style={{ width }}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
