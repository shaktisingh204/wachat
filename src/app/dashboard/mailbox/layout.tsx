import React from 'react';

/**
 * Hosted Mail (Zoho-Mail-equivalent) module shell.
 *
 * Keeps the dashboard chrome and just passes children through — the
 * webmail UX renders its own three-pane layout inside `[accountId]/`.
 */
export default function MailboxLayout({ children }: { children: React.ReactNode }) {
    return <div className="zoruui min-h-full">{children}</div>;
}
