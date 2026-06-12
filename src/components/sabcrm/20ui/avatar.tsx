'use client';

/**
 * 20ui — Avatar + AvatarGroup.
 *
 * Avatar is a thin 20ui-namespaced pass-through over the colourful
 * `TwentyAvatar` primitive (deterministic initials tint, image fallback,
 * square = company / round = person), which now lives IN this file — moved in
 * from `twenty/twenty-primitives.tsx` (that file re-exports it from here) so
 * 20ui has no imports from the legacy twenty/ kit. No behaviour is changed.
 *
 * AvatarGroup stacks several avatars with a slight negative-margin overlap and a
 * ring drawn between them (a surface-coloured outline) so they read as separate
 * chips. Past `max`, the rest collapse into a "+N" overflow chip. The group
 * carries an aria-label summarising the count and hides the individual avatars
 * from assistive tech to avoid a noisy, redundant read.
 */

import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';

// CSS previously loaded transitively through `twenty/twenty-primitives` (which
// this file used to import for TwentyAvatar). The TwentyAvatar implementation
// now lives HERE (twenty-primitives re-exports it from this file), so the same
// sheets are imported directly to keep the loaded-CSS graph identical: the
// `.st-avatar` chrome lives in surface-crm-base.css / surface-chips.css, and
// every 20ui-barrel consumer already received the full pile via the old chain.
// Trim this down when the twenty/ kit is fully retired.
import './surface-crm-base.css';
import './tokens-motion.css';
import './tokens-crm.css';
import './surface-shell.css';
import './surface-list.css';
import './surface-forms.css';
import './surface-chips.css';
import './surface-detail.css';
import './surface-board.css';
import './surface-overlays.css';
import './surface-pages.css';

import './avatar.css';

/* =========================================================================
   TwentyAvatar — the prop-driven avatar primitive.

   Moved in from `twenty/twenty-primitives.tsx` (which now re-exports it from
   here) so 20ui has zero imports from the legacy twenty/ kit. Mirrors
   twenty-ui's <Avatar>: a small square-rounded media chip that shows an image
   (`src`) when available, with a deterministic initials fallback when the
   image is absent OR fails to load. People avatars use `shape="round"` (a
   circle); company logos + everything else default to Twenty's 4px-radius
   rounded square. `size="xs"` is the 14px in-cell size used by RELATION /
   ACTOR chips and table cells.
   ========================================================================= */
export type TwentyAvatarSize = 'xs' | 'sm' | 'md' | 'lg';
export type TwentyAvatarShape = 'square' | 'round';

export type TwentyAvatarProps = {
  /** Display name — drives the initials fallback + accessible title. */
  name: string;
  /** Image / logo URL. Falls back to initials when missing or it 404s. */
  src?: string;
  size?: TwentyAvatarSize;
  /** `round` = people (circle); `square` = companies/logos (default). */
  shape?: TwentyAvatarShape;
  /** Override the initials (e.g. single glyph for actors). */
  initials?: string;
  className?: string;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase();
}

/**
 * A soft, readable colour palette for initials-fallback avatars. Picking a
 * deterministic colour per name (rather than a single flat accent tint) gives
 * lists a lively, modern feel — every company/person/actor gets its own hue,
 * echoing the colourful brand logos in a polished CRM. Each entry pairs a tinted
 * background with an accessible, saturated foreground.
 */
const AVATAR_COLORS: ReadonlyArray<{ bg: string; fg: string }> = [
  { bg: '#fdeaea', fg: '#d23f3f' }, // red
  { bg: '#fdeede', fg: '#d97a1e' }, // orange
  { bg: '#fcf5da', fg: '#b08a06' }, // amber
  { bg: '#e7f6ec', fg: '#1f9d55' }, // green
  { bg: '#e0f4f1', fg: '#0f9488' }, // teal
  { bg: '#e6f0fd', fg: '#1d6fd6' }, // blue
  { bg: '#e9eafc', fg: '#4f46e5' }, // indigo
  { bg: '#efe7fb', fg: '#7c3aed' }, // violet
  { bg: '#fce8f3', fg: '#c2369b' }, // pink
  { bg: '#e8eef6', fg: '#3f5d8a' }, // slate
];

/** Deterministically map a name to one of the {@link AVATAR_COLORS}. */
function avatarColor(name: string): { bg: string; fg: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!;
}

export function TwentyAvatar({
  name,
  src,
  size = 'md',
  shape = 'square',
  initials,
  className,
}: TwentyAvatarProps): React.JSX.Element {
  const classes = [
    'st-avatar',
    `st-avatar--${size}`,
    `st-avatar--${shape}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');
  const fallback = initials ?? initialsFromName(name);
  // Colourful, deterministic tint for the initials fallback (skipped when an
  // image is present so logos/photos keep their own colours).
  const tint = src ? undefined : avatarColor(name);
  return (
    <span
      className={classes}
      title={name}
      aria-label={name}
      style={tint ? { background: tint.bg, color: tint.fg } : undefined}
    >
      {/* Initials sit underneath; a successful image paints over them. If the
          image fails to load, onError hides it so the initials show through —
          this keeps the component free of React state so it stays SSR-safe. */}
      <span className="st-avatar__initials" aria-hidden={src ? 'true' : undefined}>
        {fallback}
      </span>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          className="st-avatar__img"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : null}
    </span>
  );
}

export type AvatarSize = TwentyAvatarSize;
export type AvatarShape = TwentyAvatarShape;

/**
 * Two shapes:
 *  • the original prop-driven form ({@link TwentyAvatarProps}: `name`, `src?`, …)
 *  • the Ui20-compatible compound form — `<Avatar><AvatarImage/><AvatarFallback/></Avatar>`
 *    — where the children supply the image + initials, so `name` is not required.
 *
 * `name` is required only when no `children` are given, which keeps every existing
 * prop-driven caller type-checking exactly as before.
 */
export type AvatarProps =
  | TwentyAvatarProps
  | (Omit<React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>, 'color'> & {
      children: React.ReactNode;
    });

function isCompound(
  props: AvatarProps,
): props is React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> & {
  children: React.ReactNode;
} {
  return 'children' in props && props.children != null;
}

/**
 * The 20ui avatar. Backward-compatible with the prop-driven {@link TwentyAvatar}
 * (`name`, `src?`, `size`, `shape`, `initials?`, `className`) AND a drop-in for
 * the Ui20 compound API: when given `children`, it renders a Radix
 * `Avatar.Root` so `<Avatar><AvatarImage/><AvatarFallback>JD</AvatarFallback></Avatar>`
 * works. The compound container is a circle by default — pass `data-shape="square"`
 * to square the corners, matching the prop-driven `shape`.
 */
export function Avatar(props: AvatarProps): React.JSX.Element {
  if (isCompound(props)) {
    const { className, children, ...rest } = props;
    return (
      <AvatarPrimitive.Root
        className={['u-avatar', className].filter(Boolean).join(' ')}
        {...rest}
      >
        {children}
      </AvatarPrimitive.Root>
    );
  }
  // Not the compound form (no `children`): a prop-driven avatar. The two union
  // members overlap structurally, so TS won't narrow this via the negative
  // branch of the guard — assert the prop-driven shape, which `isCompound`
  // has ruled out at runtime.
  return <TwentyAvatar {...(props as TwentyAvatarProps)} />;
}

/**
 * Image slot for the compound {@link Avatar}. A token-styled Radix `Avatar.Image`
 * that covers the frame (`object-cover`) and inherits the container's radius; it
 * fades in subtly once the source loads (≤200ms, disabled under reduced-motion).
 * Radix automatically unmounts it on load error so the {@link AvatarFallback}
 * shows through. `alt` is forwarded — always pass one for accessibility.
 */
export const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(function AvatarImage({ className, ...props }, ref) {
  return (
    <AvatarPrimitive.Image
      ref={ref}
      className={['u-avatar__img', className].filter(Boolean).join(' ')}
      {...props}
    />
  );
});

/**
 * Fallback slot for the compound {@link Avatar} — a token-styled Radix
 * `Avatar.Fallback` with a muted background and centred initials, shown until the
 * image loads (or permanently when there is no image). Children carry the text
 * (e.g. `JD`), which is read by assistive tech, so no extra label is needed.
 */
export const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(function AvatarFallback({ className, ...props }, ref) {
  return (
    <AvatarPrimitive.Fallback
      ref={ref}
      className={['u-avatar__fallback', className].filter(Boolean).join(' ')}
      {...props}
    />
  );
});

export interface AvatarGroupProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Max avatars to render before collapsing the rest into a "+N" chip. */
  max?: number;
  /** Size applied to every avatar in the stack. */
  size?: AvatarSize;
  /** Shape applied to every avatar in the stack. */
  shape?: AvatarShape;
  /** A row of <Avatar /> (or any node) — extras beyond `max` become "+N". */
  children: React.ReactNode;
  /** Accessible name for the group; falls back to a count summary. */
  label?: string;
}

/**
 * Overlapping stack of avatars with a "+N" overflow chip. Children are cloned so
 * the shared `size` / `shape` flow down without the caller repeating them, and
 * each gets a ring so overlapping avatars stay legible against one another.
 */
export function AvatarGroup({
  max,
  size = 'md',
  shape,
  label,
  className,
  children,
  ...rest
}: AvatarGroupProps): React.JSX.Element {
  const items = React.Children.toArray(children).filter(React.isValidElement);
  const total = items.length;
  const limit = typeof max === 'number' && max > 0 ? max : total;
  const shown = items.slice(0, limit);
  const overflow = total - shown.length;

  const ariaLabel =
    label ??
    (total === 1 ? '1 person' : `${total} people`) +
      (overflow > 0 ? `, showing ${shown.length}` : '');

  return (
    <div
      className={['u-avatar-group', `u-avatar-group--${size}`, className]
        .filter(Boolean)
        .join(' ')}
      role="group"
      aria-label={ariaLabel}
      {...rest}
    >
      {shown.map((child, i) => {
        const el = child as React.ReactElement<{
          size?: AvatarSize;
          shape?: AvatarShape;
        }>;
        return (
          <span className="u-avatar-group__item" key={child.key ?? i} aria-hidden="true">
            {React.cloneElement(el, {
              size: el.props.size ?? size,
              shape: el.props.shape ?? shape,
            })}
          </span>
        );
      })}
      {overflow > 0 ? (
        <span
          className={['u-avatar-group__item', 'u-avatar-overflow', `u-avatar-overflow--${shape ?? 'square'}`]
            .join(' ')}
          aria-hidden="true"
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}

export default Avatar;
