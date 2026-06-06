'use client';

import { Button } from '@/components/sabcrm/20ui/compat';
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
  default: 'bg-zoru-surface text-zoru-ink',
  success: 'bg-zoru-surface',
  error: 'bg-zoru-surface',
  warning: 'bg-zoru-surface',
};

const titleColor: Record<Variant, string> = {
  default: 'text-zoru-ink',
  success: 'text-zoru-ink dark:text-zoru-ink-muted',
  error: 'text-zoru-ink',
  warning: 'text-zoru-ink dark:text-zoru-ink-muted',
};

const iconColor: Record<Variant, string> = {
  default: 'text-zoru-ink-muted',
  success: 'text-zoru-ink dark:text-zoru-ink-muted',
  error: 'text-zoru-ink',
  warning: 'text-zoru-ink dark:text-zoru-ink-muted',
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
                  <p className="text-xs text-zoru-ink-muted">{message}</p>
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
                        ? 'text-zoru-ink hover:bg-zoru-ink/10 dark:hover:bg-zoru-surface-2/20'
                        : variant === 'error'
                        ? 'text-zoru-ink hover:bg-zoru-ink/10 dark:hover:bg-zoru-ink/20'
                        : variant === 'warning'
                        ? 'text-zoru-ink hover:bg-zoru-ink/10 dark:hover:bg-zoru-surface-2/20'
                        : 'text-zoru-ink hover:bg-zoru-surface-2/10 dark:hover:bg-zoru-surface-2/20'
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
                  className="rounded-full p-1 hover:bg-zoru-surface-2/50 dark:hover:bg-zoru-surface-2/30 transition-colors focus:outline-none focus:ring-2 focus:ring-zoru-line"
                  aria-label="Dismiss notification"
                >
                  <X className="h-3 w-3 text-zoru-ink-muted" />
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
