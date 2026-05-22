'use client';

import * as React from 'react';
import { GripVertical, Settings2 } from 'lucide-react';
import {
  Button,
  Sheet,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetHeader,
  ZoruSheetTitle,
  ZoruSheetTrigger,
  Switch,
  useZoruToast,
} from '@/components/zoruui';
import {
  getMyWidgets,
  reorderWidgets,
  toggleWidget,
  type DashboardType,
  type WidgetKey,
  type WidgetPref,
} from '@/app/actions/dashboard-widgets.actions';
import { cn } from '@/components/zoruui/lib/cn';

export interface WidgetConfigDrawerProps {
  dashboardType: DashboardType;
  triggerLabel?: string;
  triggerVariant?: 'outline' | 'default' | 'ghost';
  /** Notifies the parent page when widget prefs change (toggle / reorder). */
  onConfigChange?: () => void;
}

export function WidgetConfigDrawer({
  dashboardType,
  triggerLabel = 'Configure widgets',
  triggerVariant = 'outline',
  onConfigChange,
}: WidgetConfigDrawerProps) {
  const { toast } = useZoruToast();
  const [open, setOpen] = React.useState(false);
  const [widgets, setWidgets] = React.useState<WidgetPref[]>([]);
  const [loading, setLoading] = React.useState(false);
  const dragKey = React.useRef<WidgetKey | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    getMyWidgets(dashboardType)
      .then((w) => setWidgets(w))
      .catch(() => setWidgets([]))
      .finally(() => setLoading(false));
  }, [open, dashboardType]);

  const handleToggle = (key: WidgetKey, next: boolean) => {
    setWidgets((prev) =>
      prev.map((w) => (w.widgetKey === key ? { ...w, enabled: next } : w)),
    );
    void toggleWidget(dashboardType, key, next).then((res) => {
      if (res.error) {
        toast({ title: 'Save failed', description: res.error, variant: 'destructive' });
        return;
      }
      onConfigChange?.();
    });
  };

  const handleDragStart = (key: WidgetKey) => {
    dragKey.current = key;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetKey: WidgetKey) => {
    const src = dragKey.current;
    dragKey.current = null;
    if (!src || src === targetKey) return;
    setWidgets((prev) => {
      const next = [...prev];
      const fromIdx = next.findIndex((w) => w.widgetKey === src);
      const toIdx = next.findIndex((w) => w.widgetKey === targetKey);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      const reIndexed = next.map((w, i) => ({ ...w, position: i }));
      void reorderWidgets(
        dashboardType,
        reIndexed.map((w) => w.widgetKey),
      ).then((res) => {
        if (res.error) {
          toast({ title: 'Reorder failed', description: res.error, variant: 'destructive' });
          return;
        }
        onConfigChange?.();
      });
      return reIndexed;
    });
  };

  return (
    <ZoruSheet open={open} onOpenChange={setOpen}>
      <ZoruSheetTrigger asChild>
        <ZoruButton variant={triggerVariant} size="sm">
          <Settings2 className="h-4 w-4" strokeWidth={1.75} />
          {triggerLabel}
        </ZoruButton>
      </ZoruSheetTrigger>
      <ZoruSheetContent side="right" className="w-full max-w-md">
        <ZoruSheetHeader>
          <ZoruSheetTitle>Configure dashboard widgets</ZoruSheetTitle>
          <ZoruSheetDescription>
            Toggle widgets on/off and drag to reorder. Changes save automatically.
          </ZoruSheetDescription>
        </ZoruSheetHeader>

        <div className="mt-4 flex flex-col gap-2">
          {loading ? (
            <p className="text-sm text-zoru-ink-muted">Loading widgets…</p>
          ) : widgets.length === 0 ? (
            <p className="text-sm text-zoru-ink-muted">No widgets available for this dashboard.</p>
          ) : (
            widgets.map((w) => (
              <div
                key={w.widgetKey}
                draggable
                onDragStart={() => handleDragStart(w.widgetKey)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(w.widgetKey)}
                className={cn(
                  'flex items-center gap-3 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-3',
                  !w.enabled && 'opacity-60',
                )}
              >
                <GripVertical
                  className="h-4 w-4 cursor-grab text-zoru-ink-subtle"
                  strokeWidth={1.75}
                  aria-label="Drag to reorder"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-zoru-ink">{w.label}</p>
                  <p className="text-[12px] text-zoru-ink-muted">{w.description}</p>
                </div>
                <ZoruSwitch
                  checked={w.enabled}
                  onCheckedChange={(c) => handleToggle(w.widgetKey, Boolean(c))}
                  aria-label={`Toggle ${w.label}`}
                />
              </div>
            ))
          )}
        </div>
      </ZoruSheetContent>
    </ZoruSheet>
  );
}
