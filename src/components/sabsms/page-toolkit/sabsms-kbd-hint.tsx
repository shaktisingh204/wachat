"use client";

import * as React from "react";
import { Keyboard } from "lucide-react";

import {
  ZoruButton,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruKbd,
} from "@/components/zoruui";

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
      <ZoruButton
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label="Keyboard shortcuts"
      >
        <Keyboard className="mr-1.5 h-3.5 w-3.5" />
        {triggerLabel ?? <ZoruKbd>?</ZoruKbd>}
      </ZoruButton>
      <ZoruDialog open={open} onOpenChange={setOpen}>
        <ZoruDialogContent className="max-w-md">
          <ZoruDialogHeader>
            <ZoruDialogTitle>Keyboard shortcuts</ZoruDialogTitle>
            <ZoruDialogDescription>
              Press <ZoruKbd>?</ZoruKbd> from any page to open this list.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <ul className="space-y-2">
            {shortcuts.map((s, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">{s.description}</span>
                <span className="flex items-center gap-1">
                  {s.keys.map((k, ki) => (
                    <ZoruKbd key={ki}>{k}</ZoruKbd>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </ZoruDialogContent>
      </ZoruDialog>
    </>
  );
}
