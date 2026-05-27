import type { ReactNode } from 'react';

/**
 * Public portal layout.
 *
 * Used by customer-facing pages under `/p/*` — pages that leads or
 * clients reach via a shared URL without authenticating. This layout
 * intentionally avoids the Clay sidebar/topbar chrome. It renders a
 * centered, calm surface that is safe to share externally.
 */
export default function PublicPortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="zoruui min-h-screen w-full bg-zoru-surface text-zoru-ink">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6">
        <header className="flex items-center justify-between border-b border-zoru-line pb-4">
          <div className="flex items-center gap-2">
            <div
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-zoru-ink text-[13px] font-bold text-white font-mono"
            >
              API
            </div>
            <span className="text-[14px] font-bold tracking-tight text-zoru-ink font-mono">
              SABNODE // CUSTOMER.PORTAL
            </span>
          </div>
          <span className="text-[11.5px] font-mono uppercase bg-zoru-surface-2 px-2.5 py-1 rounded text-zoru-ink-muted border border-zoru-line">
            Secure Shared Reference
          </span>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="pt-6 border-t border-zoru-line text-center text-[11.5px] font-mono text-zoru-ink-muted">
          // Secured by SabNode Protocol. This page is intended solely for the recipient.
        </footer>
      </div>
    </div>
  );
}
