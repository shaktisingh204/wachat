'use client';

import { Button } from '@/components/sabcrm/20ui';
import {
  forwardRef,
  useImperativeHandle,
  useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Toaster as SonnerToaster,
  toast as sonnerToast,
  } from 'sonner';
import {
  CheckCircle,
  AlertCircle,
  Info,
  AlertTriangle,
  X,
  } from 'lucide-react';

import { cn } from '@/lib/utils';

type Variant = 'default' | 'success' | 'error' | 'warning';
type Position =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

interface ActionButton {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'ghost';
}

interface ToasterProps {
  title?: string;
  message: string;
  variant?: Variant;
  duration?: number;
  position?: Position;
  actions?: ActionButton;
  onDismiss?: () => void;
  highlightTitle?: boolean;
}

export interface ToasterRef {
  show: (props: ToasterProps) => void;
}

const variantStyles: Record<Variant, string> = {
  default: 'bg-[var(--st-surface)] text-[var(--st-text)]',
  success: 'bg-[var(--st-surface)]',
  error: 'bg-[var(--st-surface)]',
  warning: 'bg-[var(--st-surface)]',
};

const titleColor: Record<Variant, string> = {
  default: 'text-[var(--st-text)]',
  success: 'text-[var(--st-text)] dark:text-[var(--st-text-secondary)]',
  error: 'text-[var(--st-text)]',
  warning: 'text-[var(--st-text)] dark:text-[var(--st-text-secondary)]',
};

const iconColor: Record<Variant, string> = {
  default: 'text-[var(--st-text-secondary)]',
  success: 'text-[var(--st-text)] dark:text-[var(--st-text-secondary)]',
  error: 'text-[var(--st-text)]',
  warning: 'text-[var(--st-text)] dark:text-[var(--st-text-secondary)]',
};

const variantIcons: Record<Variant, React.ComponentType<{ className?: string }>> = {
  default: Info,
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
};

const toastAnimation = {
  initial: { opacity: 0, y: 50, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 50, scale: 0.95 },
};

const Toaster = forwardRef<ToasterRef, { defaultPosition?: Position }>(
  ({ defaultPosition = 'bottom-right' }, ref) => {
    const toastReference = useRef<ReturnType<typeof sonnerToast.custom> | null>(null);

    useImperativeHandle(ref, () => ({
      show({
        title,
        message,
        variant = 'default',
        duration = 4000,
        position = defaultPosition,
        actions,
        onDismiss,
        highlightTitle,
      }) {
        const Icon = variantIcons[variant];

        toastReference.current = sonnerToast.custom(
          (toastId) => (
            <motion.div
              variants={toastAnimation}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className={cn(
                'flex items-center justify-between w-full max-w-xs p-3 rounded-xl shadow-md',
                variantStyles[variant]
              )}
            >
              <div className="flex items-start gap-2">
                <Icon className={cn('h-4 w-4 mt-0.5 flex-shrink-0', iconColor[variant])} />
                <div className="space-y-0.5">
                  {title && (
                    <h3
                      className={cn(
                        'text-xs font-medium leading-none',
                        titleColor[variant],
                        highlightTitle && titleColor['success']
                      )}
                    >
                      {title}
                    </h3>
                  )}
                  <p className="text-xs text-[var(--st-text-secondary)]">{message}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {actions?.label && (
                  <Button
                    variant={actions.variant || 'outline'}
                    size="sm"
                    onClick={() => {
                      actions.onClick();
                      sonnerToast.dismiss(toastId);
                    }}
                    className={cn(
                      'cursor-pointer',
                      variant === 'success'
                        ? 'text-[var(--st-text)] hover:bg-[var(--st-text)]/10 dark:hover:bg-[var(--st-bg-muted)]/20'
                        : variant === 'error'
                        ? 'text-[var(--st-text)] hover:bg-[var(--st-text)]/10 dark:hover:bg-[var(--st-text)]/20'
                        : variant === 'warning'
                        ? 'text-[var(--st-text)] hover:bg-[var(--st-text)]/10 dark:hover:bg-[var(--st-bg-muted)]/20'
                        : 'text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]/10 dark:hover:bg-[var(--st-bg-muted)]/20'
                    )}
                  >
                    {actions.label}
                  </Button>
                )}

                <button
                  onClick={() => {
                    sonnerToast.dismiss(toastId);
                    onDismiss?.();
                  }}
                  className="rounded-full p-1 hover:bg-[var(--st-bg-muted)]/50 dark:hover:bg-[var(--st-bg-muted)]/30 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--st-border)]"
                  aria-label="Dismiss notification"
                >
                  <X className="h-3 w-3 text-[var(--st-text-secondary)]" />
                </button>
              </div>
            </motion.div>
          ),
          { duration, position }
        );
      },
    }));

    return (
      <SonnerToaster
        position={defaultPosition}
        toastOptions={{ unstyled: true, className: 'flex justify-end' }}
      />
    );
  }
);

Toaster.displayName = 'SonnerToaster';

export default Toaster;
