import * as React from 'react';
import type { LucideIcon } from 'lucide-react';

import '@/components/sabcrm/20ui/surface-crm-base.css';
// 20ui — SabCRM's design system (motion · interaction · accessibility layer).
import '@/components/sabcrm/20ui/tokens-motion.css';
// ui20 CRM theme — re-skins the whole CRM (tokens + chrome) to the new look.
// Imported AFTER the base sheets so its token + chrome overrides win, then the
// per-surface polish layers (each wins by source order + specificity).
import '@/components/sabcrm/20ui/tokens-crm.css';
import '@/components/sabcrm/20ui/surface-shell.css';
import '@/components/sabcrm/20ui/surface-list.css';
import '@/components/sabcrm/20ui/surface-forms.css';
import '@/components/sabcrm/20ui/surface-chips.css';
import '@/components/sabcrm/20ui/surface-detail.css';
import '@/components/sabcrm/20ui/surface-board.css';
import '@/components/sabcrm/20ui/surface-overlays.css';
import '@/components/sabcrm/20ui/surface-pages.css';
import { Button } from '../20ui/button';

/* =========================================================================
   TwentyButton

   Thin compatibility shim over the 20ui <Button>. The CRM's `.sabcrm-twenty`
   frame is one of 20ui's two scoped roots, so the 20ui button renders natively
   here with the same `--st-*` tokens. The public prop API (variant + icon +
   native button props) is preserved, so all existing consumers are unchanged
   while the whole CRM inherits the 20ui button (motion, focus ring, press
   feedback). `icon` maps to 20ui's `iconLeft`; primary/secondary/ghost map 1:1.
   ========================================================================= */
export type TwentyButtonVariant = 'primary' | 'secondary' | 'ghost';

export type TwentyButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: TwentyButtonVariant;
  icon?: LucideIcon;
};

export function TwentyButton({
  variant = 'secondary',
  icon: Icon,
  className,
  children,
  type = 'button',
  ...rest
}: TwentyButtonProps): React.JSX.Element {
  return (
    <Button variant={variant} iconLeft={Icon} type={type} className={className} {...rest}>
      {children}
    </Button>
  );
}

/* =========================================================================
   TwentyChip
   ========================================================================= */
export type TwentyChipProps = {
  label: string;
  color?: string;
  className?: string;
};

export function TwentyChip({ label, color, className }: TwentyChipProps): React.JSX.Element {
  const classes = ['st-chip', className].filter(Boolean).join(' ');
  return (
    <span className={classes}>
      {color ? (
        <span className="st-chip__dot" style={{ background: color }} aria-hidden="true" />
      ) : null}
      <span className="st-chip__label">{label}</span>
    </span>
  );
}

/* =========================================================================
   TwentyAvatar

   The implementation moved to the 20ui design system
   (`src/components/sabcrm/20ui/avatar.tsx`, which builds its 20ui <Avatar>
   on top of it) so 20ui has zero imports from this legacy kit. Re-exported
   here so all existing twenty-kit consumers keep working against the ONE
   shared implementation. Deep file import (not the 20ui root barrel), so no
   barrel self-cycle.
   ========================================================================= */
export {
  TwentyAvatar,
  type TwentyAvatarProps,
  type TwentyAvatarSize,
  type TwentyAvatarShape,
} from '../20ui/avatar';

/* =========================================================================
   TwentyPageHeader
   ========================================================================= */
export type TwentyPageHeaderProps = {
  title: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  className?: string;
};

export function TwentyPageHeader({
  title,
  icon: Icon,
  actions,
  className,
}: TwentyPageHeaderProps): React.JSX.Element {
  const classes = ['st-page-header', className].filter(Boolean).join(' ');
  return (
    <header className={classes}>
      {Icon ? (
        <span className="st-page-header__icon" aria-hidden="true">
          <Icon size={16} />
        </span>
      ) : null}
      <h1 className="st-page-header__title">{title}</h1>
      {actions ? <div className="st-page-header__actions">{actions}</div> : null}
    </header>
  );
}
