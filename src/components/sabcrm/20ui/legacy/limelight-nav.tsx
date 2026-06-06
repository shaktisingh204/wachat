"use client";

import * as React from "react";

import { cn } from "./lib/cn";

export interface ZoruLimelightItem {
  id: string | number;
  icon: React.ReactNode;
  label?: string;
  onClick?: () => void;
}

export interface ZoruLimelightNavProps {
  items: ZoruLimelightItem[];
  defaultActiveIndex?: number;
  activeIndex?: number;
  onChange?: (index: number) => void;
  className?: string;
  itemClassName?: string;
  highlightClassName?: string;
}

/**
 * Adaptive-width icon nav with an animated underline that slides to
 * the active item. Pure neutral palette — black underline, zinc icons.
 */
export function ZoruLimelightNav({
  items,
  defaultActiveIndex = 0,
  activeIndex: controlled,
  onChange,
  className,
  itemClassName,
  highlightClassName,
}: ZoruLimelightNavProps) {
  const [internal, setInternal] = React.useState(defaultActiveIndex);
  const active = controlled ?? internal;
  const containerRef = React.useRef<HTMLDivElement>(null);
  const itemRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const [highlight, setHighlight] = React.useState<{ left: number; width: number }>({
    left: 0,
    width: 0,
  });
  const [ready, setReady] = React.useState(false);

  React.useLayoutEffect(() => {
    const node = itemRefs.current[active];
    const parent = containerRef.current;
    if (!node || !parent) return;
    const nodeRect = node.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    setHighlight({
      left: nodeRect.left - parentRect.left,
      width: nodeRect.width,
    });
    setReady(true);
  }, [active, items.length]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative inline-flex items-center gap-1 rounded-full border border-zoru-line bg-zoru-bg p-1.5",
        className,
      )}
    >
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          ref={(el) => {
            itemRefs.current[index] = el;
          }}
          aria-label={item.label}
          onClick={() => {
            if (controlled === undefined) setInternal(index);
            onChange?.(index);
            item.onClick?.();
          }}
          className={cn(
            "relative inline-flex h-9 w-9 items-center justify-center rounded-full text-zoru-ink-muted transition-colors",
            "hover:text-zoru-ink",
            index === active && "text-zoru-ink",
            "focus-visible:outline-none [&_svg]:size-4",
            itemClassName,
          )}
        >
          {item.icon}
        </button>
      ))}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute bottom-0 h-[2px] rounded-full bg-zoru-ink",
          ready ? "transition-[transform,width] duration-300 ease-out" : "opacity-0",
          highlightClassName,
        )}
        style={{
          width: highlight.width * 0.4,
          transform: `translateX(${highlight.left + highlight.width * 0.3}px)`,
        }}
      />
    </div>
  );
}
