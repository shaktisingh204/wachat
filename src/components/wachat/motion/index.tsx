"use client";

/**
 * WaChat cinematic motion kit
 *
 * WhatsApp-flavoured motion primitives for the WaChat rewrite. Sibling of
 * src/components/sabmail/motion — same engineering rules:
 *   - predetermined loops live in CSS (wachat-motion.css), GPU-only props;
 *   - orchestrated/stateful motion uses `framer-motion` directly (a separate
 *     package instance from the app's `motion/react` LazyMotion, so it is NOT
 *     governed by LazyMotion `strict` and is safe to use as `motion.*` here);
 *   - everything degrades gracefully under prefers-reduced-motion.
 *
 * Tokens (--st-*) resolve on :root, so these work anywhere in the app.
 */

import * as React from "react";
import { AnimatePresence, animate, motion, useReducedMotion } from "framer-motion";
import { Megaphone } from "lucide-react";

import { cn } from "@/lib/utils";

import "./wachat-motion.css";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/* ===================================================================
 * Message delivery ticks — sent ✓ · delivered ✓✓ · read (blue) ✓✓
 * =================================================================== */
export type WaMessageStatus = "pending" | "sent" | "delivered" | "read" | "failed";

/** A single chevron tick path. */
function TickPath({ dx = 0, second = false }: { dx?: number; second?: boolean }) {
  return (
    <path
      className={cn("wachat-ticks__path", second && "wachat-ticks__path--second")}
      d={`M${2 + dx} 9 l3.4 3.4 l6.2 -7.4`}
    />
  );
}

/**
 * Animated WhatsApp delivery ticks. The ticks draw on; crossing into `read`
 * flips colour to WhatsApp blue with a soft flash. `pending` shows a clock,
 * `failed` shows a red exclamation.
 */
export function MessageTicks({
  status,
  size = 16,
  className,
}: {
  status: WaMessageStatus;
  size?: number;
  className?: string;
}) {
  const prev = React.useRef<WaMessageStatus>(status);
  const justRead = prev.current !== "read" && status === "read";
  React.useEffect(() => {
    prev.current = status;
  }, [status]);

  if (status === "pending") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        className={cn("wachat-ticks", className)}
        role="img"
        aria-label="Sending"
        fill="none"
      >
        <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 5 v3 l2 1.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }
  if (status === "failed") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        className={cn("wachat-ticks", className)}
        style={{ color: "var(--st-danger, #dc2626)" }}
        role="img"
        aria-label="Failed to send"
        fill="none"
      >
        <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 4.6 v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="8" cy="11.2" r="0.9" fill="currentColor" />
      </svg>
    );
  }

  const doubled = status === "delivered" || status === "read";
  const label =
    status === "read" ? "Read" : status === "delivered" ? "Delivered" : "Sent";

  return (
    <svg
      width={doubled ? size + 5 : size}
      height={size}
      viewBox={doubled ? "0 0 21 16" : "0 0 16 16"}
      className={cn("wachat-ticks", className)}
      data-status={status}
      data-flash={justRead ? "1" : undefined}
      role="img"
      aria-label={label}
      fill="none"
      key={status /* re-mount per status so the draw animation replays */}
    >
      <TickPath />
      {doubled ? <TickPath dx={5} second /> : null}
    </svg>
  );
}

/* ===================================================================
 * Message bubble entrance — lift-off (outgoing) / slide-in (incoming)
 * =================================================================== */
export function MessageBubble({
  direction,
  children,
  className,
  animateEnter = true,
}: {
  direction: "in" | "out";
  children: React.ReactNode;
  className?: string;
  /** Set false to render statically (e.g. history above the fold). */
  animateEnter?: boolean;
}) {
  return (
    <div
      className={cn(
        animateEnter && (direction === "out" ? "wachat-bubble--out" : "wachat-bubble--in"),
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ===================================================================
 * Typing indicator (incoming "… is typing")
 * =================================================================== */
export function TypingIndicator({ className, label = "Typing" }: { className?: string; label?: string }) {
  return (
    <span className={cn("wachat-typing", className)} role="status" aria-label={label}>
      <span aria-hidden />
      <span aria-hidden />
      <span aria-hidden />
    </span>
  );
}

/* ===================================================================
 * AI stream cursor + streaming text wrapper
 * =================================================================== */
export function StreamCursor({ className }: { className?: string }) {
  return <span className={cn("wachat-caret", className)} aria-hidden />;
}

/** Renders streaming text with a blinking caret while `streaming` is true. */
export function StreamingText({
  text,
  streaming,
  className,
}: {
  text: string;
  streaming: boolean;
  className?: string;
}) {
  return (
    <span className={className} aria-live="polite">
      {text}
      {streaming ? <StreamCursor /> : null}
    </span>
  );
}

/* ===================================================================
 * Processing dots (AI working) + Spinner
 * =================================================================== */
export function ProcessingDots({ className }: { className?: string }) {
  return (
    <span className={cn("wachat-dots", className)} role="status" aria-label="Working">
      <span aria-hidden />
      <span aria-hidden />
      <span aria-hidden />
    </span>
  );
}

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
      className={cn("wachat-spinner", className)}
      style={{ width: size, height: size }}
      role="status"
      aria-label={label}
    />
  );
}

/* ===================================================================
 * SuccessCheck — draw-on circle + tick
 * =================================================================== */
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
      className={cn("wachat-check", className)}
      viewBox="0 0 56 56"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
      fill="none"
    >
      <circle className="wachat-check__circle" cx="28" cy="28" r="26" />
      <path className="wachat-check__tick" d="M16 29 l8 8 l16 -18" />
    </svg>
  );
}

/* ===================================================================
 * IndeterminateBar + LiveDot
 * =================================================================== */
export function IndeterminateBar({ className, label = "Working" }: { className?: string; label?: string }) {
  return (
    <span className={cn("wachat-bar", className)} role="progressbar" aria-label={label}>
      <span className="wachat-bar__fill" aria-hidden />
    </span>
  );
}

export function LiveDot({ active = true, className }: { active?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block h-1.5 w-1.5 rounded-full",
        active
          ? "wachat-livedot bg-[var(--st-status-ok,#16a34a)] text-[var(--st-status-ok,#16a34a)]"
          : "bg-[var(--st-text-secondary)]",
        className,
      )}
    />
  );
}

/* ===================================================================
 * Broadcast launch hero — pulse rings + recipient fan-out
 * =================================================================== */
export function BroadcastPulse({
  size = 72,
  icon,
  label = "Launching broadcast",
  className,
}: {
  size?: number;
  icon?: React.ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn("wachat-pulse wachat-motion", className)}
      style={{ ["--wachat-pulse-size" as string]: `${size}px` }}
      role="status"
      aria-label={label}
    >
      <span className="wachat-pulse__ring" aria-hidden />
      <span className="wachat-pulse__ring" aria-hidden />
      <span className="wachat-pulse__ring" aria-hidden />
      <span className="wachat-pulse__core" aria-hidden>
        {icon ?? <Megaphone className="h-1/2 w-1/2" />}
      </span>
    </span>
  );
}

/** Recipient dots flying outward from a center point — campaign send energy. */
export function DeliveryFanout({ dots = 10, className }: { dots?: number; className?: string }) {
  // Deterministic angles (no Math.random → SSR-stable).
  const pieces = React.useMemo(() => {
    return Array.from({ length: dots }).map((_, i) => {
      const angle = (i / dots) * Math.PI * 2;
      const radius = 46 + ((i * 7) % 22);
      return {
        dx: `${Math.cos(angle) * radius}px`,
        dy: `${Math.sin(angle) * radius}px`,
        delay: `${(i % 5) * 90}ms`,
      };
    });
  }, [dots]);
  return (
    <span className={cn("wachat-fanout wachat-motion", className)} aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="wachat-fanout__dot"
          style={
            {
              ["--dx" as string]: p.dx,
              ["--dy" as string]: p.dy,
              animationDelay: p.delay,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}

/* ===================================================================
 * Confetti — celebration burst over a relative parent
 * =================================================================== */
const CONFETTI_COLORS = [
  "var(--st-accent, #25d366)",
  "#34b7f1",
  "#f59e0b",
  "#ef4444",
  "#a855f7",
  "#22c55e",
];

export function Confetti({
  show,
  pieces = 36,
  className,
}: {
  show: boolean;
  pieces?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const items = React.useMemo(() => {
    return Array.from({ length: pieces }).map((_, i) => {
      // Deterministic pseudo-random spread keyed on index (SSR-stable).
      const left = ((i * 37) % 100) + (((i * 13) % 7) - 3) * 0.5;
      const fall = 220 + ((i * 53) % 180);
      const dur = 1500 + ((i * 91) % 900);
      const delay = (i % 8) * 60;
      const spin = (i % 2 === 0 ? 1 : -1) * (360 + ((i * 71) % 540));
      return {
        left: `${Math.max(0, Math.min(100, left))}%`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        fall: `${fall}px`,
        dur: `${dur}ms`,
        delay: `${delay}ms`,
        spin: `${spin}deg`,
        round: i % 3 === 0,
      };
    });
  }, [pieces]);

  if (!show || reduce) return null;

  return (
    <span className={cn("wachat-confetti", className)} aria-hidden>
      {items.map((it, i) => (
        <span
          key={i}
          className="wachat-confetti__piece"
          style={
            {
              left: it.left,
              background: it.color,
              borderRadius: it.round ? "50%" : "1px",
              ["--fall" as string]: it.fall,
              ["--dur" as string]: it.dur,
              ["--delay" as string]: it.delay,
              ["--spin" as string]: it.spin,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}

/* ===================================================================
 * Status chip — animated colour transition across the delivery lifecycle
 * =================================================================== */
const STATUS_TONE: Record<string, string> = {
  queued: "var(--st-text-secondary, #6b7280)",
  scheduled: "var(--st-info, #34b7f1)",
  sending: "var(--st-warn, #f59e0b)",
  sent: "var(--st-text-secondary, #6b7280)",
  delivered: "var(--st-status-ok, #16a34a)",
  read: "#34b7f1",
  failed: "var(--st-danger, #dc2626)",
  pending: "var(--st-warn, #f59e0b)",
  approved: "var(--st-status-ok, #16a34a)",
  rejected: "var(--st-danger, #dc2626)",
  paused: "var(--st-text-secondary, #6b7280)",
  active: "var(--st-status-ok, #16a34a)",
};

export function StatusChip({
  status,
  label,
  className,
}: {
  status: string;
  /** Override the visible label (defaults to a Title-cased status). */
  label?: React.ReactNode;
  className?: string;
}) {
  const tone = STATUS_TONE[status] ?? "var(--st-text-secondary, #6b7280)";
  const text = label ?? status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span className={cn("wachat-statuschip", className)} style={{ color: tone }} data-status={status}>
      <span className="wachat-statuschip__dot" aria-hidden />
      <span style={{ color: "var(--st-text)" }}>{text}</span>
    </span>
  );
}

/* ===================================================================
 * CreatingOverlay — absolute overlay over a relative parent
 * =================================================================== */
export function CreatingOverlay({
  show,
  title,
  subtitle,
  variant = "broadcast",
  icon,
}: {
  show: boolean;
  title: string;
  subtitle?: string;
  /** `broadcast` → pulse rings; `process` → bouncing dots. */
  variant?: "broadcast" | "process";
  icon?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          key="wachat-creating"
          className="wachat-motion absolute inset-0 z-[5] grid place-items-center rounded-[inherit] backdrop-blur-[3px]"
          style={{ background: "color-mix(in srgb, var(--st-bg) 78%, transparent)" }}
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
            {variant === "broadcast" ? (
              <BroadcastPulse label={title} icon={icon} />
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

/* ===================================================================
 * FadeUp / Stagger helpers (CSS-driven)
 * =================================================================== */
export function FadeUp({
  children,
  className,
  index,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  index?: number;
  as?: React.ElementType;
}) {
  return (
    <Tag
      className={cn(index != null ? "wachat-stagger-item" : "wachat-fade-up", className)}
      style={index != null ? ({ ["--i" as string]: index } as React.CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}

export function Stagger({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("wachat-motion", className)}>{children}</div>;
}

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
      className={cn("wachat-stagger-item", className)}
      style={{ ["--i" as string]: index } as React.CSSProperties}
    >
      {children}
    </Tag>
  );
}

/* ===================================================================
 * CountUp — animated number for KPI tiles
 * =================================================================== */
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
