'use client';

/**
 * 20ui — UserDropdown.
 *
 * The account menu for the app shell: a compact avatar trigger that opens a
 * token-skinned dropdown with a header row (name / email / role), a list of
 * navigation items, a separator, and a destructive sign-out row.
 *
 * It composes two already-built 20ui modules rather than re-implementing
 * anything: {@link Avatar} for the trigger chip and the {@link DropdownMenu}
 * family (Radix-driven, so it inherits roving focus, typeahead, Escape +
 * outside-click dismissal, full `role="menu"` wiring, collision-aware
 * positioning, and focus restore to the trigger on close).
 *
 *   <UserDropdown
 *     user={{ name: 'Ada Lovelace', email: 'ada@sabnode.io', role: 'Admin' }}
 *     items={[
 *       { id: 'profile', label: 'Profile', icon: User, href: '/settings/profile' },
 *       { id: 'settings', label: 'Settings', icon: Settings, onSelect: openSettings },
 *     ]}
 *     onSignOut={handleSignOut}
 *   />
 */

import * as React from 'react';
import {
  ChevronsUpDown,
  LogOut,
  type LucideIcon,
} from 'lucide-react';

import { Avatar } from './avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown';

import './userdropdown.css';

const cx = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(' ');

/** The signed-in account this menu represents. */
export interface UserDropdownUser {
  /** Display name — drives the avatar initials + the header row. */
  name: string;
  /** Email shown under the name in both the trigger and the header. */
  email: string;
  /** Optional avatar image URL; falls back to coloured initials. */
  avatarUrl?: string;
  /** Optional role label (e.g. "Admin", "Sales") shown as a header eyebrow. */
  role?: string;
}

/** A single navigation row rendered above the sign-out separator. */
export interface UserDropdownItem {
  /** Stable React key + identity. */
  id: string;
  /** The row label (e.g. "Settings"). */
  label: React.ReactNode;
  /** Leading icon (decorative; rendered `aria-hidden`). */
  icon?: LucideIcon;
  /** Internal route — wired onto the row as a real anchor. */
  href?: string;
  /** Fired when the row is chosen (click or keyboard). */
  onSelect?: () => void;
  /** Disable the row. */
  disabled?: boolean;
}

export interface UserDropdownProps
  extends Omit<React.HTMLAttributes<HTMLButtonElement>, 'children'> {
  /** The signed-in account. May be undefined before the session resolves. */
  user?: UserDropdownUser;
  /** Navigation rows above the sign-out item. Defaults to none. */
  items?: UserDropdownItem[];
  /** Fired when the danger sign-out row is chosen. Omit to hide sign-out. */
  onSignOut?: () => void;
  /** Label for the sign-out row. */
  signOutLabel?: string;
  /** Hide the name/email/chevron beside the avatar (avatar-only trigger). */
  compact?: boolean;
  /** Which edge of the trigger the menu aligns to. */
  align?: 'start' | 'center' | 'end';
}

/**
 * One menu row. When an `href` is present we render a real anchor inside the
 * item (via Radix `asChild`) so the row is a native link — middle-click /
 * cmd-click / "open in new tab" all work, and the keyboard still activates it.
 */
function UserMenuRow({ item }: { item: UserDropdownItem }): React.JSX.Element {
  const Icon = item.icon;
  const icon = Icon ? <Icon className="u-dropdown__item-icon" aria-hidden="true" /> : null;

  // Radix forwards onSelect (click + keyboard) to the item; we run the caller's
  // handler from there so both anchors and plain rows fire the same callback.
  const handleSelect = React.useCallback(() => {
    item.onSelect?.();
  }, [item]);

  if (item.href) {
    return (
      <DropdownMenuItem asChild disabled={item.disabled} onSelect={handleSelect}>
        <a href={item.href} className="u-userdrop__link">
          {icon}
          <span className="u-userdrop__rowlabel">{item.label}</span>
        </a>
      </DropdownMenuItem>
    );
  }

  return (
    <DropdownMenuItem disabled={item.disabled} onSelect={handleSelect}>
      {icon}
      <span className="u-userdrop__rowlabel">{item.label}</span>
    </DropdownMenuItem>
  );
}

/**
 * The account menu. Forwards its ref to the trigger `<button>` so callers can
 * focus / measure it from the app shell.
 */
export const UserDropdown = React.forwardRef<HTMLButtonElement, UserDropdownProps>(
  function UserDropdown(
    {
      user,
      items = [],
      onSignOut,
      signOutLabel = 'Sign out',
      compact = false,
      align = 'end',
      className,
      ...rest
    },
    ref,
  ) {
    // The shell can mount this before the session resolves, so `user` may be
    // undefined — fall back to safe placeholders instead of crashing on the
    // destructure (`name` also feeds the Avatar's initials).
    const { name = 'Account', email, avatarUrl, role } = user ?? {};

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            ref={ref}
            type="button"
            className={cx('u-userdrop__trigger', compact && 'u-userdrop__trigger--compact', className)}
            aria-label={compact ? `Account menu for ${name}` : undefined}
            {...rest}
          >
            <Avatar name={name} src={avatarUrl} shape="round" size="md" />
            {!compact && (
              <>
                <span className="u-userdrop__triggerbody">
                  <span className="u-userdrop__triggername">{name}</span>
                  <span className="u-userdrop__triggermail">{email}</span>
                </span>
                <ChevronsUpDown className="u-userdrop__chevron" aria-hidden="true" />
              </>
            )}
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align={align} className="u-userdrop__menu">
          {/* Header — name / email, with role as a small eyebrow. Plain (not a
              DropdownMenuLabel) so the casing stays human, not the uppercase
              section-label treatment. */}
          <div className="u-userdrop__header">
            <Avatar name={name} src={avatarUrl} shape="round" size="md" />
            <span className="u-userdrop__headerbody">
              {role ? <span className="u-userdrop__role">{role}</span> : null}
              <span className="u-userdrop__name">{name}</span>
              <span className="u-userdrop__mail">{email}</span>
            </span>
          </div>

          {(items.length > 0 || onSignOut) && <DropdownMenuSeparator />}

          {items.map((item) => (
            <UserMenuRow key={item.id} item={item} />
          ))}

          {onSignOut && (
            <>
              {items.length > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem
                variant="danger"
                iconLeft={LogOut}
                onSelect={onSignOut}
              >
                <span className="u-userdrop__rowlabel">{signOutLabel}</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
);

export default UserDropdown;
