"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Radio } from "lucide-react";

import { cn } from "@/lib/utils";

import "./sabsms-motion.css";

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
      className={cn("sabsms-connect sabsms-motion", className)}
      style={{ ["--sabsms-connect-size" as string]: `${size}px` }}
      role="status"
      aria-label={label}
    >
      <span className="sabsms-connect__ring" aria-hidden />
      <span className="sabsms-connect__ring" aria-hidden />
      <span className="sabsms-connect__ring" aria-hidden />
      <span className="sabsms-connect__core" aria-hidden>
        {icon ?? <Radio className="h-1/2 w-1/2" />}
      </span>
    </span>
  );
}

/* ---- ProcessingDots — three bouncing dots ------------------------ */
export function ProcessingDots({ className }: { className?: string }) {
  return (
    <span
      className={cn("sabsms-dots sabsms-motion", className)}
      role="status"
      aria-label="Working"
    >
      <span aria-hidden />
      <span aria-hidden />
      <span aria-hidden />
    </span>
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
      className={cn("sabsms-check sabsms-motion", className)}
      viewBox="0 0 56 56"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
      fill="none"
    >
      <circle className="sabsms-check__circle" cx="28" cy="28" r="26" />
      <path className="sabsms-check__tick" d="M16 29 l8 8 l16 -18" />
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
      className={cn("sabsms-bar sabsms-motion", className)}
      role="progressbar"
      aria-label={label}
    >
      <span className="sabsms-bar__fill" aria-hidden />
    </span>
  );
}

/* ---- CreatingOverlay — absolute overlay over a relative parent --- */
export function CreatingOverlay({
  show,
  title,
  subtitle,
  variant = "connect",
}: {
  show: boolean;
  title: string;
  subtitle?: string;
  /** `connect` → pulse rings; `process` → bouncing dots. */
  variant?: "connect" | "process";
}) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          key="sabsms-creating"
          className="sabsms-creating sabsms-motion"
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
              <ConnectingIndicator label={title} />
            ) : (
              <ProcessingDots className="text-[var(--st-accent)]" />
            )}
            <div>
              <p className="text-sm font-medium text-[var(--st-text)]">{title}</p>
              {subtitle ? (
                <p className="mt-0.5 text-xs text-[var(--st-text-secondary)]">
                  {subtitle}
                </p>
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
  /** Stagger position; sets animation-delay = index * 55ms. */
  index?: number;
  as?: React.ElementType;
}) {
  return (
    <Tag
      className={cn(index != null ? "sabsms-stagger-item" : "sabsms-fade-up", className)}
      style={index != null ? ({ ["--i" as string]: index } as React.CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}
