/**
 * /demo20 — the 20ui design-system gallery, STANDALONE.
 *
 * This route lives outside the CRM (no `.sabcrm-twenty`, no Twenty styles). It
 * renders the same {@link Ui20Showcase} wrapped only in 20ui's own `.ui20` root,
 * which proves the system is genuinely app-wide: every component resolves its
 * tokens from `tokens.css` alone, anywhere in SabNode.
 *
 * Public route (the proxy only gates /dashboard + /wachat), so it doubles as a
 * shareable component reference.
 */

import { Ui20Showcase } from '@/components/sabcrm/ui20-showcase';
import './demo20.css';

export const metadata = {
  title: '20ui — components',
  description: 'The 20ui design system: every component and variant.',
};

export default function Demo20Page() {
  return (
    <main className="20ui demo20-root">
      <Ui20Showcase />
    </main>
  );
}
