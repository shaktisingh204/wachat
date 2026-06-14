"use client";

/**
 * BroadcastLaunchOverlay (Wave 3)
 *
 * The signature "campaign launched" moment: a full-screen cinematic sequence —
 * pulse rings + recipient fan-out resolve into a success check with a confetti
 * burst. Controlled by `show`; calls `onDone` after `holdMs` so the parent can
 * dismiss. Honors prefers-reduced-motion (confetti suppressed in the kit).
 *
 * Usage:
 *   <BroadcastLaunchOverlay show={launched} recipients={count} onDone={() => setLaunched(false)} />
 */

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { BroadcastPulse, Confetti, DeliveryFanout, SuccessCheck } from "../motion";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export function BroadcastLaunchOverlay({
  show,
  recipients,
  title = "Broadcast launched",
  subtitle,
  holdMs = 2800,
  onDone,
}: {
  show: boolean;
  recipients?: number;
  title?: string;
  subtitle?: string;
  holdMs?: number;
  onDone?: () => void;
}) {
  const reduce = useReducedMotion();
  // Phase: 0 = pulse/fan-out, 1 = success check + confetti.
  const [phase, setPhase] = React.useState(0);

  React.useEffect(() => {
    if (!show) {
      setPhase(0);
      return;
    }
    const toSuccess = setTimeout(() => setPhase(1), reduce ? 0 : 1100);
    const done = setTimeout(() => onDone?.(), holdMs);
    return () => {
      clearTimeout(toSuccess);
      clearTimeout(done);
    };
  }, [show, holdMs, reduce, onDone]);

  const sub =
    subtitle ??
    (typeof recipients === "number"
      ? `Sending to ${recipients.toLocaleString()} recipient${recipients === 1 ? "" : "s"}`
      : "Your message is on its way");

  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          className="wachat-motion fixed inset-0 z-[60] grid place-items-center"
          style={{ background: "color-mix(in srgb, var(--st-bg) 82%, transparent)", backdropFilter: "blur(4px)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE_OUT }}
          role="status"
          aria-live="polite"
        >
          <Confetti show={phase === 1} pieces={44} />
          <motion.div
            className="relative flex flex-col items-center gap-4 text-center"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            transition={{ duration: 0.28, ease: EASE_OUT }}
          >
            <div className="relative grid h-[120px] w-[120px] place-items-center">
              {phase === 0 ? (
                <>
                  <BroadcastPulse size={92} label={title} />
                  <DeliveryFanout className="absolute inset-0" dots={12} />
                </>
              ) : (
                <SuccessCheck size={88} label={title} />
              )}
            </div>
            <div>
              <p className="text-lg font-semibold text-[var(--st-text)]">{title}</p>
              <p className="mt-1 text-sm text-[var(--st-text-secondary)]">{sub}</p>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default BroadcastLaunchOverlay;
