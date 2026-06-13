"use client";

import * as React from "react";
import { AnimatePresence, animate, motion, useReducedMotion } from "framer-motion";
import { Mail } from "lucide-react";

import { cn } from "@/lib/utils";

import "./sabmail-motion.css";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/* ---- ConnectingIndicator — broadcast pulse rings ----------------- */
export function ConnectingIndicator({
  size = 56,
  label = "Connecting",
  icon,
  className,
}: {
  size?: number;
  label?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn("sabmail-connect sabmail-motion", className)}
      style={{ ["--sabmail-connect-size" as string]: `${size}px` }}
      role="status"
      aria-label={label}
    >
      <span className="sabmail-connect__ring" aria-hidden />
      <span className="sabmail-connect__ring" aria-hidden />
      <span className="sabmail-connect__ring" aria-hidden />
      <span className="sabmail-connect__core" aria-hidden>
        {icon ?? <Mail className="h-1/2 w-1/2" />}
      </span>
    </span>
  );
}

/* ---- ProcessingDots — three bouncing dots ------------------------ */
export function ProcessingDots({ className }: { className?: string }) {
  return (
    <span
      className={cn("sabmail-dots sabmail-motion", className)}
      role="status"
      aria-label="Working"
    >
      <span aria-hidden />
      <span aria-hidden />
      <span aria-hidden />
    </span>
  );
}

/* ---- Spinner — simple ring spin ---------------------------------- */
export function Spinner({
  size = 16,
  className,
  label = "Loading",
}: {
  size?: number;
  className?: string;
  label?: string;
}) {
  return (
    <span
      className={cn("sabmail-spinner", className)}
      style={{ width: size, height: size }}
      role="status"
      aria-label={label}
    />
  );
}

/* ---- SuccessCheck — draw-on circle + tick ------------------------ */
export function SuccessCheck({
  size = 48,
  className,
  label = "Done",
}: {
  size?: number;
  className?: string;
  label?: string;
}) {
  return (
    <svg
      className={cn("sabmail-check sabmail-motion", className)}
      viewBox="0 0 56 56"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
      fill="none"
    >
      <circle className="sabmail-check__circle" cx="28" cy="28" r="26" />
      <path className="sabmail-check__tick" d="M16 29 l8 8 l16 -18" />
    </svg>
  );
}

/* ---- IndeterminateBar — slim "working" sweep --------------------- */
export function IndeterminateBar({
  className,
  label = "Working",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span
      className={cn("sabmail-bar sabmail-motion", className)}
      role="progressbar"
      aria-label={label}
    >
      <span className="sabmail-bar__fill" aria-hidden />
    </span>
  );
}

/* ---- LiveDot — pulsing "connected" status dot -------------------- */
export function LiveDot({
  active = true,
  className,
}: {
  active?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block h-1.5 w-1.5 rounded-full",
        active
          ? "sabmail-livedot bg-[var(--st-status-ok,#16a34a)] text-[var(--st-status-ok,#16a34a)]"
          : "bg-[var(--st-text-secondary)]",
        className,
      )}
    />
  );
}

/* ---- CreatingOverlay — absolute overlay over a relative parent --- */
export function CreatingOverlay({
  show,
  title,
  subtitle,
  variant = "connect",
  icon,
}: {
  show: boolean;
  title: string;
  subtitle?: string;
  /** `connect` → pulse rings; `process` → bouncing dots. */
  variant?: "connect" | "process";
  /** Override the icon inside the connect rings (e.g. Send / RefreshCw). */
  icon?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          key="sabmail-creating"
          className="sabmail-creating sabmail-motion"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: EASE_OUT }}
          role="status"
          aria-live="polite"
        >
          <motion.div
            className="flex flex-col items-center gap-3 text-center"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
          >
            {variant === "connect" ? (
              <ConnectingIndicator label={title} icon={icon} />
            ) : (
              <ProcessingDots className="text-[var(--st-accent)]" />
            )}
            <div>
              <p className="text-sm font-medium text-[var(--st-text)]">{title}</p>
              {subtitle ? (
                <p className="mt-0.5 text-xs text-[var(--st-text-secondary)]">{subtitle}</p>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/* ---- FadeUp / stagger helpers (CSS-driven) ----------------------- */
export function FadeUp({
  children,
  className,
  index,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  /** Stagger position; sets animation-delay = index * 45ms. */
  index?: number;
  as?: React.ElementType;
}) {
  return (
    <Tag
      className={cn(index != null ? "sabmail-stagger-item" : "sabmail-fade-up", className)}
      style={index != null ? ({ ["--i" as string]: index } as React.CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}

/** Stagger container — just establishes the motion scope. */
export function Stagger({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("sabmail-motion", className)}>{children}</div>;
}

/** One staggered child; pass its `index`. */
export function StaggerItem({
  children,
  index = 0,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  index?: number;
  className?: string;
  as?: React.ElementType;
}) {
  return (
    <Tag
      className={cn("sabmail-stagger-item", className)}
      style={{ ["--i" as string]: index } as React.CSSProperties}
    >
      {children}
    </Tag>
  );
}

/* ---- CountUp — animated number for KPI tiles --------------------- */
export function CountUp({
  value,
  durationMs = 700,
  className,
  format,
}: {
  value: number;
  durationMs?: number;
  className?: string;
  format?: (n: number) => string;
}) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = React.useState(reduce ? value : 0);

  React.useEffect(() => {
    if (reduce) {
      setDisplay(value);
      return;
    }
    const controls = animate(0, value, {
      duration: durationMs / 1000,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [value, durationMs, reduce]);

  const rounded = Math.round(display);
  return <span className={className}>{format ? format(rounded) : rounded.toLocaleString()}</span>;
}
