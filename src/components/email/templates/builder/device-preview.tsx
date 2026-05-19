'use client';

/**
 * Device preview drawer. Renders compiled HTML inside a sandboxed
 * iframe so the email's own styles can't bleed into the app shell.
 * Supports desktop / mobile / dark-mode toggles.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Monitor, Moon, Smartphone, Sun } from 'lucide-react';

import {
  ZoruButton,
  ZoruDrawer,
  ZoruDrawerContent,
  ZoruDrawerHeader,
  ZoruDrawerTitle,
  cn,
} from '@/components/zoruui';

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
    <ZoruDrawer open={open} onOpenChange={onOpenChange}>
      <ZoruDrawerContent className="h-[88vh]">
        <ZoruDrawerHeader className="flex flex-row items-center justify-between">
          <ZoruDrawerTitle>Preview</ZoruDrawerTitle>
          <div className="flex items-center gap-2">
            <ToggleGroup
              value={device}
              onChange={setDevice}
              options={[
                { value: 'desktop', label: 'Desktop', icon: Monitor },
                { value: 'mobile', label: 'Mobile', icon: Smartphone },
              ]}
            />
            <ToggleGroup
              value={color}
              onChange={setColor}
              options={[
                { value: 'light', label: 'Light', icon: Sun },
                { value: 'dark', label: 'Dark', icon: Moon },
              ]}
            />
          </div>
        </ZoruDrawerHeader>

        {warnings.length > 0 ? (
          <div className="mx-4 mb-2 rounded border border-amber-400/50 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <strong>Renderer warnings:</strong>
            <ul className="ml-4 list-disc">
              {warnings.map((w, i) => (
                <li key={`${w}-${i}`}>{w}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex h-full justify-center overflow-auto px-4 pb-6">
          <iframe
            ref={iframeRef}
            sandbox=""
            title="Email preview"
            srcDoc={srcDoc}
            style={{ width, maxWidth: '100%', height: '100%', border: '1px solid var(--zoru-line)', borderRadius: 8, background: '#fff' }}
          />
        </div>
      </ZoruDrawerContent>
    </ZoruDrawer>
  );
}

interface ToggleOption<V extends string> {
  value: V;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

function ToggleGroup<V extends string>({
  value,
  onChange,
  options,
}: {
  value: V;
  onChange: (v: V) => void;
  options: ToggleOption<V>[];
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-border">
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = opt.value === value;
        return (
          <ZoruButton
            key={opt.value}
            type="button"
            variant={active ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onChange(opt.value)}
            className={cn('rounded-none gap-1.5', active ? '' : 'text-muted-foreground')}
            aria-pressed={active}
          >
            <Icon className="h-3.5 w-3.5" />
            {opt.label}
          </ZoruButton>
        );
      })}
    </div>
  );
}
