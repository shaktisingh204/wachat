"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";

import { cn } from "./lib/cn";

export const ZoruSwitch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent",
      "transition-colors duration-200",
      "data-[state=unchecked]:bg-zoru-line-strong data-[state=checked]:bg-zoru-primary",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "focus-visible:outline-none",
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        "pointer-events-none block h-4 w-4 rounded-full bg-zoru-bg shadow-[var(--zoru-shadow-sm)] ring-0",
        "transition-transform duration-200",
        "data-[state=unchecked]:translate-x-0 data-[state=checked]:translate-x-4",
      )}
    />
  </SwitchPrimitive.Root>
));
ZoruSwitch.displayName = "ZoruSwitch";

/**
 * ZoruBouncyToggle — taller, bouncier variant inspired by the
 * "bouncy-toggle" entry in componts.txt, restated in pure neutrals.
 * Use for marketing-page yes/no toggles where extra physicality helps.
 */
export interface ZoruBouncyToggleProps {
  defaultChecked?: boolean;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function ZoruBouncyToggle({
  defaultChecked = false,
  checked: checkedProp,
  onCheckedChange,
  label,
  className,
  disabled,
}: ZoruBouncyToggleProps) {
  const [internal, setInternal] = React.useState(defaultChecked);
  const isControlled = checkedProp !== undefined;
  const isChecked = isControlled ? !!checkedProp : internal;
  const [pressed, setPressed] = React.useState(false);

  const toggle = () => {
    if (disabled) return;
    const next = !isChecked;
    if (!isControlled) setInternal(next);
    onCheckedChange?.(next);
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {label && (
        <span
          className={cn(
            "text-sm font-medium transition-colors duration-300",
            isChecked ? "text-zoru-ink" : "text-zoru-ink-muted",
          )}
        >
          {label}
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={isChecked}
        aria-disabled={disabled}
        onClick={toggle}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        className={cn(
          "group relative h-8 w-14 rounded-full p-1 transition-all duration-500 ease-out",
          "focus-visible:outline-none",
          isChecked ? "bg-zoru-ink" : "bg-zoru-line-strong",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        <div
          className={cn(
            "absolute inset-0 rounded-full transition-opacity duration-500",
            isChecked ? "opacity-100 shadow-[0_0_20px_rgba(0,0,0,0.15)]" : "opacity-0",
          )}
        />
        <div
          className={cn(
            "relative h-6 w-6 rounded-full bg-zoru-bg shadow-[var(--zoru-shadow-md)] transition-all duration-500 ease-[cubic-bezier(0.68,-0.55,0.265,1.55)]",
            isChecked ? "translate-x-6" : "translate-x-0",
            pressed && "scale-90 duration-150",
          )}
        >
          <div
            className={cn(
              "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-500",
              isChecked
                ? "h-2 w-2 bg-zoru-ink scale-100"
                : "h-1.5 w-1.5 bg-zoru-ink-subtle scale-100",
            )}
          />
        </div>
      </button>
    </div>
  );
}
