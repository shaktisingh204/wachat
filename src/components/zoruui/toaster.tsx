"use client";

import {
  ZoruToast,
  ZoruToastClose,
  ZoruToastDescription,
  ZoruToastProvider,
  ZoruToastTitle,
  ZoruToastViewport,
} from "./toast";
import { useZoruToast } from "./use-zoru-toast";

/**
 * Mount once, near the app root inside a `.zoruui` scope. Renders any
 * toast created via `zoruToast(...)` from `use-zoru-toast`.
 */
export function ZoruToaster() {
  const { toasts } = useZoruToast();

  return (
    <ZoruToastProvider>
      {toasts.map(({ id, title, description, action, ...props }) => (
        <ZoruToast key={id} {...props}>
          <div className="flex-1 min-w-0">
            {title && <ZoruToastTitle>{title}</ZoruToastTitle>}
            {description && (
              <ZoruToastDescription>{description}</ZoruToastDescription>
            )}
          </div>
          {action}
          <ZoruToastClose />
        </ZoruToast>
      ))}
      <ZoruToastViewport />
    </ZoruToastProvider>
  );
}
