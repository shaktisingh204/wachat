'use client';

import * as React from 'react';
import { GripVertical, Settings2 } from 'lucide-react';
import { Button, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, Switch, useToast } from '@/components/sabcrm/20ui/compat';
import {
  getMyWidgets,
  reorderWidgets,
  toggleWidget,
} from '@/app/actions/dashboard-widgets.actions';
import type {
  DashboardType,
  WidgetKey,
  WidgetPref,
} from '@/app/actions/dashboard-widgets.config';
import { cn } from '@/components/sabcrm/20ui/compat';

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
  const { toast } = useToast();
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
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant={triggerVariant} size="sm">
          <Settings2 className="h-4 w-4" strokeWidth={1.75} />
          {triggerLabel}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex w-full max-w-md flex-col overflow-hidden p-0"
      >
        <SheetHeader className="shrink-0 border-b border-[var(--st-border)] px-6 pb-4 pt-6">
          <SheetTitle>Configure dashboard widgets</SheetTitle>
          <SheetDescription>
            Toggle widgets on/off and drag to reorder. Changes save automatically.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div className="flex flex-col gap-2">
            {loading ? (
              <p className="text-sm text-[var(--st-text-secondary)]">Loading widgets…</p>
            ) : widgets.length === 0 ? (
              <p className="text-sm text-[var(--st-text-secondary)]">No widgets available for this dashboard.</p>
            ) : (
              widgets.map((w) => (
                <div
                  key={w.widgetKey}
                  draggable
                  onDragStart={() => handleDragStart(w.widgetKey)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(w.widgetKey)}
                  className={cn(
                    'flex items-center gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-3',
                    !w.enabled && 'opacity-60',
                  )}
                >
                  <GripVertical
                    className="h-4 w-4 cursor-grab text-[var(--st-text-tertiary)]"
                    strokeWidth={1.75}
                    aria-label="Drag to reorder"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[var(--st-text)]">{w.label}</p>
                    <p className="text-[12px] text-[var(--st-text-secondary)]">{w.description}</p>
                  </div>
                  <Switch
                    checked={w.enabled}
                    onCheckedChange={(c) => handleToggle(w.widgetKey, Boolean(c))}
                    aria-label={`Toggle ${w.label}`}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
