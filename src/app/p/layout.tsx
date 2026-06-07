import type { ReactNode } from 'react';

/**
 * Public portal layout.
 *
 * Used by customer-facing pages under `/p/*`, pages that leads or
 * clients reach via a shared URL without authenticating. This layout
 * intentionally avoids the authenticated sidebar/topbar chrome. It renders a
 * centered, calm surface that is safe to share externally.
 */
export default function PublicPortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="ui20 min-h-screen w-full bg-[var(--st-bg-secondary)] text-[var(--st-text)]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6">
        <header className="flex items-center justify-between border-b border-[var(--st-border)] pb-4">
          <div className="flex items-center gap-2">
            <div
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--st-text)] text-[13px] font-bold text-white font-mono"
            >
              API
            </div>
            <span className="text-[14px] font-bold tracking-tight text-[var(--st-text)] font-mono">
              SABNODE // CUSTOMER.PORTAL
            </span>
          </div>
          <span className="text-[11.5px] font-mono uppercase bg-[var(--st-bg-muted)] px-2.5 py-1 rounded text-[var(--st-text-secondary)] border border-[var(--st-border)]">
            Secure Shared Reference
          </span>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="pt-6 border-t border-[var(--st-border)] text-center text-[11.5px] font-mono text-[var(--st-text-secondary)]">
          // Secured by SabNode Protocol. This page is intended solely for the recipient.
        </footer>
      </div>
    </div>
  );
}
