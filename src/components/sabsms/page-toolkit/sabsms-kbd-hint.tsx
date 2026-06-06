"use client";

import * as React from "react";
import { Keyboard } from "lucide-react";

import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Kbd } from '@/components/sabcrm/20ui';

export interface SabsmsShortcut {
  keys: string[];
  description: string;
}

export interface SabsmsKbdHintProps {
  shortcuts: SabsmsShortcut[];
  triggerLabel?: string;
}

export function SabsmsKbdHint({ shortcuts, triggerLabel }: SabsmsKbdHintProps) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement | null;
        if (
          target?.tagName === "INPUT" ||
          target?.tagName === "TEXTAREA" ||
          target?.isContentEditable
        ) {
          return;
        }
        e.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label="Keyboard shortcuts"
      >
        <Keyboard className="mr-1.5 h-3.5 w-3.5" />
        {triggerLabel ?? <Kbd>?</Kbd>}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
            <DialogDescription>
              Press <Kbd>?</Kbd> from any page to open this list.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2">
            {shortcuts.map((s, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span className="text-[var(--st-text)]">{s.description}</span>
                <span className="flex items-center gap-1">
                  {s.keys.map((k, ki) => (
                    <Kbd key={ki}>{k}</Kbd>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
