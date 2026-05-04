"use client";

import { Frame760 } from "@/components/ui/sidebar-component";

/**
 * Drop-in demo. Renders the full two-line sidebar (left icon rail + right
 * detail panel + mobile Sheet drawer) over a placeholder main area.
 *
 * Live route at: `/wachat/two-line`.
 *
 * Usage in your own page / layout:
 *
 *   import { SabNodeSidebar } from "@/components/ui/sidebar-component";
 *
 *   export default function Layout({ children }: { children: React.ReactNode }) {
 *     return (
 *       <div className="flex min-h-screen">
 *         <SabNodeSidebar />
 *         <main className="flex-1">{children}</main>
 *       </div>
 *     );
 *   }
 */
export default function DemoOne() {
  return <Frame760 />;
}
