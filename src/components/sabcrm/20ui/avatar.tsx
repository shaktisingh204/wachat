'use client';

/**
 * 20ui — Avatar + AvatarGroup.
 *
 * Avatar is a thin 20ui-namespaced pass-through over the existing colourful
 * `TwentyAvatar` primitive (deterministic initials tint, image fallback,
 * square = company / round = person). We re-export it under the 20ui name so the
 * design system has a single import surface — no behaviour is changed.
 *
 * AvatarGroup stacks several avatars with a slight negative-margin overlap and a
 * ring drawn between them (a surface-coloured outline) so they read as separate
 * chips. Past `max`, the rest collapse into a "+N" overflow chip. The group
 * carries an aria-label summarising the count and hides the individual avatars
 * from assistive tech to avoid a noisy, redundant read.
 */

import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';

import {
  TwentyAvatar,
  type TwentyAvatarProps,
  type TwentyAvatarSize,
  type TwentyAvatarShape,
} from '@/components/sabcrm/twenty/twenty-primitives';

import './avatar.css';

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
