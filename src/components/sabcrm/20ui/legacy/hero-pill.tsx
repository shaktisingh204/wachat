import * as React from "react";

import { cn } from "./lib/cn";

export interface ZoruHeroPillProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  text: React.ReactNode;
  /** Animate slide-up on mount. Defaults to true. */
  animate?: boolean;
}

export function ZoruHeroPill({
  icon,
  text,
  className,
  animate = true,
  ...props
}: ZoruHeroPillProps) {
  return (
    <div
      className={cn("mb-4 inline-block", animate && "animate-slide-up", className)}
      {...props}
    >
      <p className="inline-flex items-center justify-center whitespace-nowrap rounded-full border border-zoru-line bg-zoru-bg px-3 py-1 text-sm font-medium text-zoru-ink shadow-[var(--zoru-shadow-sm)] transition-colors hover:bg-zoru-surface-2">
        {icon && (
          <span className="mr-2 flex shrink-0 border-r border-zoru-line pr-2">
            {icon}
          </span>
        )}
        {text}
      </p>
    </div>
  );
}

export function ZoruStarIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={12}
      height={12}
      fill="none"
      className="transition-transform duration-300 group-hover:scale-110"
      {...props}
    >
      <path
        className="fill-zoru-ink-muted"
        d="M6.958.713a1 1 0 0 0-1.916 0l-.999 3.33-3.33 1a1 1 0 0 0 0 1.915l3.33.999 1 3.33a1 1 0 0 0 1.915 0l.999-3.33 3.33-1a1 1 0 0 0 0-1.915l-3.33-.999-1-3.33Z"
      />
    </svg>
  );
}
