"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/sabcrm/20ui";
import { AlertTriangle, RefreshCw, Home, Copy, Check } from "lucide-react";

/**
 * Root error boundary. Self-contained on purpose: animations are pure CSS
 * (no motion library) so the recovery screen can't be taken down by the same
 * dependency graph that just crashed.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [retrying, setRetrying] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    console.error(error);
  }, [error]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const handleRetry = () => {
    setRetrying(true);
    // Let the spinner paint for a beat before the boundary re-renders.
    setTimeout(() => reset(), 350);
  };

  const handleCopy = async () => {
    const detail = [
      `message: ${error.message || "unknown"}`,
      error.digest ? `digest: ${error.digest}` : null,
      `url: ${typeof window !== "undefined" ? window.location.href : ""}`,
      `time: ${new Date().toISOString()}`,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(detail);
      setCopied(true);
    } catch {
      /* clipboard unavailable; button simply stays unchanged */
    }
  };

  return (
    <main className="sb-err">
      {/* ambient backdrop */}
      <div className="sb-err__aura" aria-hidden="true" />
      <div className="sb-err__grid" aria-hidden="true" />

      <div className="sb-err__inner">
        {/* ── Text column ─────────────────────────────────────── */}
        <div className="sb-err__copy">
          <div className="sb-err__chip sb-err-rise" style={{ animationDelay: "60ms" }}>
            <span className="sb-err__chip-dot" aria-hidden="true" />
            Unexpected error
            {error.digest ? (
              <code className="sb-err__chip-digest">{error.digest}</code>
            ) : null}
          </div>

          <h1 className="sb-err__title sb-err-rise" style={{ animationDelay: "130ms" }}>
            Something went wrong
          </h1>

          <p className="sb-err__desc sb-err-rise" style={{ animationDelay: "200ms" }}>
            An unexpected error interrupted this page. Your data is safe, and a
            retry usually fixes it.
          </p>

          <div className="sb-err__actions sb-err-rise" style={{ animationDelay: "270ms" }}>
            <Button
              variant="primary"
              size="lg"
              iconLeft={RefreshCw}
              loading={retrying}
              onClick={handleRetry}
            >
              Try again
            </Button>
            <Button
              variant="outline"
              size="lg"
              iconLeft={Home}
              onClick={() => {
                window.location.href = "/";
              }}
            >
              Back to home
            </Button>
          </div>

          <details className="sb-err__details sb-err-rise" style={{ animationDelay: "340ms" }}>
            <summary>Technical details</summary>
            <div className="sb-err__details-body">
              <pre className="sb-err__details-pre">
                {error.message || "No error message was provided."}
                {error.digest ? `\n\ndigest: ${error.digest}` : ""}
              </pre>
              <Button
                variant="ghost"
                size="sm"
                iconLeft={copied ? Check : Copy}
                onClick={handleCopy}
              >
                {copied ? "Copied" : "Copy details"}
              </Button>
            </div>
          </details>
        </div>

        {/* ── Animated app-window mockup (decorative) ─────────── */}
        <div className="sb-err__scene" aria-hidden="true">
          <div className="sb-err__orbit">
            <span className="sb-err__orbit-dot" />
          </div>
          <span className="sb-err__spark sb-err__spark--1" />
          <span className="sb-err__spark sb-err__spark--2" />
          <span className="sb-err__spark sb-err__spark--3" />

          <div className="sb-err__window">
            <div className="sb-err__titlebar">
              <span className="sb-err__light sb-err__light--r" />
              <span className="sb-err__light sb-err__light--y" />
              <span className="sb-err__light sb-err__light--g" />
              <span className="sb-err__address">
                <span className="sb-err__address-text">sabnode</span>
                <span className="sb-err__address-bar" />
              </span>
            </div>

            <div className="sb-err__body">
              <div className="sb-err__sidebar">
                <span className="sb-err__navdot is-active" />
                <span className="sb-err__navdot" />
                <span className="sb-err__navdot" />
                <span className="sb-err__navdot" />
              </div>

              <div className="sb-err__content">
                <div className="sb-err__line sb-err__line--title" />
                <div className="sb-err__cards">
                  <div className="sb-err__card">
                    <span className="sb-err__line sb-err__line--sm" />
                    <span className="sb-err__line sb-err__line--xs" />
                  </div>
                  <div className="sb-err__card sb-err__card--broken">
                    <span className="sb-err__line sb-err__line--sm" />
                    <span className="sb-err__line sb-err__line--xs" />
                  </div>
                </div>
                <div className="sb-err__line" />
                <div className="sb-err__line sb-err__line--short" />
              </div>
            </div>

            <span className="sb-err__scanline" />
          </div>

          <div className="sb-err__badge">
            <span className="sb-err__badge-ring" />
            <AlertTriangle size={20} strokeWidth={2.2} />
          </div>
        </div>
      </div>

      <style>{`
        .sb-err {
          position: relative;
          isolation: isolate;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px 24px;
          overflow: hidden;
          background: var(--st-bg-secondary);
          color: var(--st-text);
        }

        /* ambient backdrop */
        .sb-err__aura {
          position: absolute;
          inset: 0;
          z-index: -2;
          background:
            radial-gradient(560px 380px at 72% 38%, var(--st-accent-soft), transparent 70%),
            radial-gradient(420px 300px at 18% 78%, var(--st-danger-soft), transparent 72%);
          opacity: 0.8;
        }
        .sb-err__grid {
          position: absolute;
          inset: 0;
          z-index: -1;
          background-image:
            linear-gradient(var(--st-border) 1px, transparent 1px),
            linear-gradient(90deg, var(--st-border) 1px, transparent 1px);
          background-size: 44px 44px;
          opacity: 0.25;
          mask-image: radial-gradient(620px 460px at 60% 45%, black 30%, transparent 75%);
          -webkit-mask-image: radial-gradient(620px 460px at 60% 45%, black 30%, transparent 75%);
        }

        .sb-err__inner {
          display: grid;
          grid-template-columns: 1fr;
          gap: 56px;
          align-items: center;
          width: 100%;
          max-width: 980px;
        }
        @media (min-width: 900px) {
          .sb-err__inner { grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr); }
        }

        /* ── text column ── */
        .sb-err__copy { max-width: 460px; }

        .sb-err__chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 5px 12px;
          border: 1px solid var(--st-border);
          border-radius: var(--st-radius-pill);
          background: var(--st-bg);
          font-size: 12px;
          font-weight: 600;
          color: var(--st-text-secondary);
          box-shadow: var(--st-shadow-sm);
        }
        .sb-err__chip-dot {
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: var(--st-danger);
          animation: sb-err-blink 2.2s ease-in-out infinite;
        }
        .sb-err__chip-digest {
          font-family: var(--font-sab-mono, ui-monospace, monospace);
          font-size: 11px;
          font-weight: 500;
          color: var(--st-text-secondary);
          padding: 1px 6px;
          border-radius: var(--st-radius-sm);
          background: var(--st-bg-muted);
        }

        .sb-err__title {
          margin: 18px 0 0;
          font-size: clamp(28px, 4.5vw, 40px);
          line-height: 1.08;
          font-weight: 750;
          letter-spacing: -0.025em;
        }
        .sb-err__desc {
          margin: 14px 0 0;
          font-size: 15px;
          line-height: 1.6;
          color: var(--st-text-secondary);
          max-width: 40ch;
        }
        .sb-err__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 26px;
        }

        .sb-err__details {
          margin-top: 26px;
          border: 1px solid var(--st-border);
          border-radius: var(--st-radius-lg);
          background: var(--st-bg);
          overflow: hidden;
        }
        .sb-err__details summary {
          padding: 10px 14px;
          font-size: 13px;
          font-weight: 600;
          color: var(--st-text-secondary);
          cursor: pointer;
          user-select: none;
          transition: color 160ms ease;
        }
        .sb-err__details summary:hover { color: var(--st-text); }
        .sb-err__details summary:focus-visible {
          outline: none;
          box-shadow: inset 0 0 0 2px var(--st-accent-ring);
          border-radius: var(--st-radius);
        }
        .sb-err__details-body {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 8px;
          padding: 0 14px 12px;
        }
        .sb-err__details-pre {
          width: 100%;
          margin: 0;
          padding: 10px 12px;
          border-radius: var(--st-radius);
          background: var(--st-bg-muted);
          font-family: var(--font-sab-mono, ui-monospace, monospace);
          font-size: 12px;
          line-height: 1.5;
          color: var(--st-text-secondary);
          white-space: pre-wrap;
          word-break: break-word;
          max-height: 160px;
          overflow: auto;
        }

        /* ── scene ── */
        .sb-err__scene {
          position: relative;
          display: none;
          justify-self: center;
          width: min(400px, 100%);
        }
        @media (min-width: 640px) {
          .sb-err__scene { display: block; }
        }

        .sb-err__window {
          position: relative;
          overflow: hidden;
          border: 1px solid var(--st-border);
          border-radius: 14px;
          background: var(--st-bg);
          box-shadow: var(--st-shadow-lg);
          animation: sb-err-float 7s ease-in-out infinite;
        }

        .sb-err__titlebar {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 11px 14px;
          border-bottom: 1px solid var(--st-border);
        }
        .sb-err__light { width: 9px; height: 9px; border-radius: 999px; opacity: 0.85; }
        .sb-err__light--r { background: #e5604c; animation: sb-err-blink 3.4s ease-in-out infinite; }
        .sb-err__light--y { background: #e2b33c; }
        .sb-err__light--g { background: #58b368; }
        .sb-err__address {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-left: 12px;
          flex: 1;
          height: 22px;
          padding: 0 10px;
          border-radius: var(--st-radius-pill);
          background: var(--st-bg-muted);
          overflow: hidden;
        }
        .sb-err__address-text {
          font-family: var(--font-sab-mono, ui-monospace, monospace);
          font-size: 10px;
          color: var(--st-text-secondary);
        }
        .sb-err__address-bar {
          position: relative;
          flex: 1;
          height: 3px;
          border-radius: 999px;
          background: var(--st-border);
          overflow: hidden;
        }
        .sb-err__address-bar::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: var(--st-accent);
          transform-origin: left;
          animation: sb-err-progress 3.2s cubic-bezier(0.65, 0, 0.35, 1) infinite;
        }

        .sb-err__body {
          display: grid;
          grid-template-columns: 44px 1fr;
        }
        .sb-err__sidebar {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 16px 0;
          border-right: 1px solid var(--st-border);
        }
        .sb-err__navdot {
          width: 16px;
          height: 16px;
          border-radius: 5px;
          background: var(--st-bg-muted);
        }
        .sb-err__navdot.is-active { background: var(--st-accent-soft); box-shadow: inset 0 0 0 1.5px var(--st-accent); }

        .sb-err__content {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 16px;
        }

        .sb-err__line {
          position: relative;
          height: 9px;
          border-radius: 999px;
          background: var(--st-bg-muted);
          overflow: hidden;
        }
        .sb-err__line::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, var(--st-bg), transparent);
          transform: translateX(-100%);
          animation: sb-err-shimmer 2.6s ease-in-out infinite;
        }
        .sb-err__line--title { width: 55%; height: 12px; }
        .sb-err__line--short { width: 70%; }
        .sb-err__line--sm { width: 80%; height: 7px; }
        .sb-err__line--xs { width: 50%; height: 7px; }

        .sb-err__cards {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .sb-err__card {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 14px 12px;
          border: 1px solid var(--st-border);
          border-radius: 10px;
          background: var(--st-bg);
          box-shadow: var(--st-shadow-sm);
        }
        .sb-err__card--broken {
          border-color: color-mix(in srgb, var(--st-danger) 35%, var(--st-border));
          background: var(--st-danger-soft);
          transform-origin: 20% 0%;
          animation: sb-err-tilt 5.5s ease-in-out infinite;
        }
        .sb-err__card--broken .sb-err__line,
        .sb-err__card--broken .sb-err__line::after { animation: none; }
        .sb-err__card--broken .sb-err__line {
          background: color-mix(in srgb, var(--st-danger) 18%, var(--st-bg));
        }

        .sb-err__scanline {
          position: absolute;
          left: 0;
          right: 0;
          top: 0;
          height: 34px;
          background: linear-gradient(180deg, transparent, var(--st-accent-ring), transparent);
          opacity: 0;
          animation: sb-err-scan 6s ease-in-out infinite;
          pointer-events: none;
        }

        .sb-err__badge {
          position: absolute;
          top: -16px;
          right: -10px;
          display: grid;
          place-items: center;
          width: 46px;
          height: 46px;
          border-radius: 999px;
          border: 1px solid color-mix(in srgb, var(--st-danger) 30%, var(--st-border));
          background: var(--st-bg);
          color: var(--st-danger);
          box-shadow: var(--st-shadow-md);
          animation: sb-err-bob 4s ease-in-out infinite;
        }
        .sb-err__badge-ring {
          position: absolute;
          inset: -1px;
          border-radius: inherit;
          border: 1.5px solid var(--st-danger);
          opacity: 0;
          animation: sb-err-ping 2.8s cubic-bezier(0.16, 1, 0.3, 1) infinite;
        }

        .sb-err__orbit {
          position: absolute;
          inset: -34px;
          border: 1.5px dashed var(--st-border);
          border-radius: 24px;
          animation: sb-err-float 9s ease-in-out infinite reverse;
        }
        .sb-err__orbit-dot {
          position: absolute;
          top: -4px;
          left: 18%;
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: var(--st-accent);
          animation: sb-err-slide 8s linear infinite;
        }

        .sb-err__spark {
          position: absolute;
          border-radius: 999px;
          background: var(--st-accent);
          opacity: 0.45;
        }
        .sb-err__spark--1 { width: 6px; height: 6px; top: -8%; left: -6%; animation: sb-err-drift 6s ease-in-out infinite; }
        .sb-err__spark--2 { width: 9px; height: 9px; bottom: -10%; right: 8%; background: var(--st-danger); animation: sb-err-drift 7.5s ease-in-out 0.8s infinite; }
        .sb-err__spark--3 { width: 5px; height: 5px; top: 30%; right: -9%; animation: sb-err-drift 5.2s ease-in-out 1.6s infinite; }

        /* ── keyframes ── */
        .sb-err-rise {
          opacity: 0;
          animation: sb-err-rise 640ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes sb-err-rise {
          from { opacity: 0; transform: translateY(14px) scale(0.99); }
          to { opacity: 1; transform: none; }
        }
        @keyframes sb-err-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-9px); }
        }
        @keyframes sb-err-bob {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-6px) rotate(4deg); }
        }
        @keyframes sb-err-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        @keyframes sb-err-shimmer {
          0% { transform: translateX(-100%); }
          55%, 100% { transform: translateX(100%); }
        }
        @keyframes sb-err-tilt {
          0%, 100% { transform: rotate(0deg) translateY(0); }
          12% { transform: rotate(-5deg) translateY(3px); }
          24% { transform: rotate(-3.4deg) translateY(2px); }
          60% { transform: rotate(-4.2deg) translateY(3px); }
          82% { transform: rotate(-1deg) translateY(1px); }
        }
        @keyframes sb-err-scan {
          0%, 58%, 100% { opacity: 0; transform: translateY(-40px); }
          64% { opacity: 1; }
          78% { opacity: 0; transform: translateY(300px); }
        }
        @keyframes sb-err-ping {
          0% { opacity: 0.7; transform: scale(1); }
          70%, 100% { opacity: 0; transform: scale(1.55); }
        }
        @keyframes sb-err-progress {
          0% { transform: scaleX(0); }
          45% { transform: scaleX(0.72); }
          70% { transform: scaleX(0.78); }
          100% { transform: scaleX(1); }
        }
        @keyframes sb-err-slide {
          0% { left: 12%; opacity: 0; }
          10%, 90% { opacity: 1; }
          100% { left: 84%; opacity: 0; }
        }
        @keyframes sb-err-drift {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(6px, -12px); }
        }

        @media (prefers-reduced-motion: reduce) {
          .sb-err-rise {
            animation: sb-err-fade 240ms ease forwards;
          }
          .sb-err__window,
          .sb-err__badge,
          .sb-err__badge-ring,
          .sb-err__orbit,
          .sb-err__orbit-dot,
          .sb-err__spark,
          .sb-err__scanline,
          .sb-err__chip-dot,
          .sb-err__light--r,
          .sb-err__card--broken,
          .sb-err__line::after,
          .sb-err__address-bar::after {
            animation: none;
          }
          .sb-err__card--broken { transform: rotate(-3deg); }
          .sb-err__address-bar::after { transform: scaleX(0.75); }
          .sb-err__badge-ring { opacity: 0; }
          .sb-err__scanline { opacity: 0; }
        }
        @keyframes sb-err-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </main>
  );
}
