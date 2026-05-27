/**
 * EmptyState — centred "nothing here yet" pattern used by SabWa lists.
 *
 * Distinct from `@/components/zoruui` EmptyState which depends on
 * `motion/react`. This is a lighter, dependency-free variant designed
 * for use inside SabWa panes (inbox empty pane, chat with no
 * messages, etc.).
 *
 * @example
 *   <EmptyState
 *     icon={MessageSquare}
 *     title="No conversation selected"
 *     description="Choose a chat from the list to start messaging."
 *     action={<Button>Start chat</Button>}
 *   />
 */

import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  /**
   * Lucide icon component, or any custom node (e.g. an SVG illustration).
   */
  icon?: LucideIcon | React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Optional primary action — usually a `<Button>`. */
  action?: React.ReactNode;
  className?: string;
}

function isRenderableComponent(
  icon: unknown,
): icon is React.ComponentType<{ className?: string; "aria-hidden"?: boolean }> {
  if (typeof icon === "function") return true;
  // Lucide icons are React.forwardRef(...) — objects carrying $$typeof.
  return (
    typeof icon === "object" &&
    icon !== null &&
    "$$typeof" in (icon as object) &&
    "render" in (icon as object)
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  let iconNode: React.ReactNode = null;
  if (icon) {
    if (React.isValidElement(icon)) {
      iconNode = icon;
    } else if (isRenderableComponent(icon)) {
      const Icon = icon;
      iconNode = <Icon className="h-6 w-6" aria-hidden />;
    } else {
      iconNode = icon as React.ReactNode;
    }
  }

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col items-center justify-center gap-3 p-8 text-center",
        className,
      )}
      role="status"
    >
      {iconNode ? (
        <div
          aria-hidden
          className="flex h-12 w-12 items-center justify-center rounded-[var(--zoru-radius-lg)] bg-zoru-surface text-zoru-ink-muted"
        >
          {iconNode}
        </div>
      ) : null}
      <div className="space-y-1">
        <h3 className="text-base font-semibold tracking-tight text-zoru-ink">{title}</h3>
        {description ? (
          <p className="mx-auto max-w-sm text-sm text-zoru-ink-muted">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export default EmptyState;
