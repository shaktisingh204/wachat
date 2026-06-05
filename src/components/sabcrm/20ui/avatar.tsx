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

import {
  TwentyAvatar,
  type TwentyAvatarProps,
  type TwentyAvatarSize,
  type TwentyAvatarShape,
} from '@/components/sabcrm/twenty/twenty-primitives';

import './avatar.css';

export type AvatarSize = TwentyAvatarSize;
export type AvatarShape = TwentyAvatarShape;
export type AvatarProps = TwentyAvatarProps;

/**
 * The 20ui avatar — a pass-through wrapper over {@link TwentyAvatar}. Same props
 * (`name`, `src?`, `size`, `shape`, `initials?`, `className`); exists so callers
 * import avatars from the 20ui namespace alongside the rest of the system.
 */
export function Avatar(props: AvatarProps): React.JSX.Element {
  return <TwentyAvatar {...props} />;
}

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
