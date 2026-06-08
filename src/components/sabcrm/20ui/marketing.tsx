'use client';

/**
 * 20ui — Marketing primitives.
 *
 * The small set of landing / marketing-surface blocks the rest of the system
 * composes into hero sections, feature pages and "coming soon" route stubs:
 *
 *  · HeroPill        — an eyebrow pill (optional star/icon + label + optional link)
 *  · Logos3          — a responsive "trusted by" logo wall, grayscale to colour on hover
 *  · CallToAction    — a centered CTA band (heading + subtext + primary/secondary buttons)
 *  · StatisticsCard  — a big-number stat block (named to avoid the `StatCard` collision)
 *  · RouteComingSoon — a centered placeholder for not-yet-built routes (icon + title + body)
 *
 * Built to the four standing skills: transform/opacity-only motion on the custom
 * eases (<250ms, scale-on-press, a reduced-motion block disables movement);
 * native elements first with a visible focus ring + complete ARIA; one restrained
 * accent + one radius system; realistic demo strings live only in comments and
 * carry zero em-dashes in any visible text.
 *
 * Composes the already-built {@link Button} for CTA actions so the band inherits
 * the system's pressable behaviour and focus ring for free.
 */

import * as React from 'react';
import { Sparkles, ArrowRight, Clock } from 'lucide-react';

import { Button, type ButtonVariant } from './button';
import { renderIcon, type IconProp } from './_icon';

import './marketing.css';

/* ===========================================================================
   HeroPill — eyebrow pill (optional leading star/icon + label + optional link)
   =========================================================================== */

export interface HeroPillProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Pill label. e.g. "Now in public beta". */
  label: React.ReactNode;
  /**
   * Leading mark. Pass `false` to drop it, a {@link LucideIcon} component to
   * swap it, or leave undefined for the default sparkle. Decorative either way.
   */
  icon?: IconProp | false;
  /** Turns the pill into a link (renders an <a>). e.g. "/changelog". */
  href?: string;
  /** Link target — only used when `href` is set. */
  target?: React.HTMLAttributeAnchorTarget;
  /** Optional trailing call-out shown after a divider. e.g. "Read more". */
  action?: React.ReactNode;
  /** Slide-up + fade-in on mount. Defaults to true. */
  animate?: boolean;
}

/**
 * An eyebrow pill for the top of a hero. As an <a> when `href` is set (so it is
 * keyboard-focusable and announced as a link), otherwise a static <span>.
 */
export const HeroPill = React.forwardRef<HTMLElement, HeroPillProps>(
  function HeroPill(
    { label, icon, href, target, action, animate = true, className, ...rest },
    ref,
  ) {
    const resolvedIcon: IconProp | null = icon === false ? null : icon ?? Sparkles;
    const cls = ['u-hero-pill', animate && 'u-hero-pill--animate', className]
      .filter(Boolean)
      .join(' ');

    const inner = (
      <>
        {resolvedIcon ? (
          <span className="u-hero-pill__mark" aria-hidden="true">
            {renderIcon(resolvedIcon, { size: 13 })}
          </span>
        ) : null}
        <span className="u-hero-pill__label">{label}</span>
        {action != null ? (
          <span className="u-hero-pill__action">
            <span className="u-hero-pill__divider" aria-hidden="true" />
            {action}
            <ArrowRight className="u-hero-pill__arrow" size={12} aria-hidden="true" />
          </span>
        ) : null}
      </>
    );

    if (href) {
      const relProps =
        target === '_blank' ? { rel: 'noreferrer noopener' } : undefined;
      return (
        <a
          ref={ref as React.Ref<HTMLAnchorElement>}
          href={href}
          target={target}
          {...relProps}
          className={[cls, 'u-hero-pill--link'].join(' ')}
          {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
        >
          {inner}
        </a>
      );
    }

    return (
      <span
        ref={ref as React.Ref<HTMLSpanElement>}
        className={cls}
        {...(rest as React.HTMLAttributes<HTMLSpanElement>)}
      >
        {inner}
      </span>
    );
  },
);

/* ===========================================================================
   Logos3 — responsive logo wall, grayscale to colour on hover
   =========================================================================== */

export interface MarketingLogo {
  /** Stable key. */
  id: string;
  /** Accessible label / company name. e.g. "Acme Inc". */
  name: string;
  /** Image src. Prefer a single-colour SVG or transparent PNG. */
  src?: string;
  /** Or supply a custom node (an inline SVG, a wordmark) instead of `src`. */
  node?: React.ReactNode;
  /** Optional link wrapping the logo. e.g. "https://acme.example". */
  href?: string;
}

export interface Logos3Props
  extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  /** Eyebrow above the wall. e.g. "Trusted by fast-moving teams". */
  heading?: React.ReactNode;
  /** The logos to display. */
  logos: MarketingLogo[];
}

/**
 * A calm, static logo wall (a wrapping flex row, centered). Each logo sits
 * desaturated and dimmed until hovered/focused, then resolves to full colour.
 * Static by design (no marquee) so it reads as quiet supporting evidence.
 */
export const Logos3 = React.forwardRef<HTMLElement, Logos3Props>(
  function Logos3({ heading, logos, className, ...rest }, ref) {
    return (
      <section
        ref={ref}
        className={['u-logos', className].filter(Boolean).join(' ')}
        {...rest}
      >
        {heading != null ? <h3 className="u-logos__heading">{heading}</h3> : null}
        <ul className="u-logos__row">
          {logos.map((logo) => (
            <li className="u-logos__item" key={logo.id}>
              <LogoMark logo={logo} />
            </li>
          ))}
        </ul>
      </section>
    );
  },
);

function LogoMark({ logo }: { logo: MarketingLogo }): React.JSX.Element {
  // When the logo is a link, the <a> carries the accessible name (aria-label),
  // so the visual inside is hidden from AT to avoid a doubled read. When it is
  // static, the name rides on the <img alt> or a labelled wrapper for nodes.
  if (logo.href) {
    const visual = logo.node ? (
      <span className="u-logos__node">{logo.node}</span>
    ) : (
      <img className="u-logos__img" src={logo.src} alt="" />
    );
    return (
      <a
        className="u-logos__link"
        href={logo.href}
        target="_blank"
        rel="noreferrer noopener"
        aria-label={logo.name}
      >
        {visual}
      </a>
    );
  }

  if (logo.node) {
    return (
      <span className="u-logos__link" role="img" aria-label={logo.name}>
        <span className="u-logos__node" aria-hidden="true">
          {logo.node}
        </span>
      </span>
    );
  }
  return (
    <span className="u-logos__link">
      <img className="u-logos__img" src={logo.src} alt={logo.name} />
    </span>
  );
}

/* ===========================================================================
   CallToAction — centered CTA band (heading + subtext + buttons)
   =========================================================================== */

export interface CtaAction {
  /** Button label. e.g. "Start free trial". */
  label: React.ReactNode;
  /** Link target. If set, the action renders the band's own anchor. */
  href?: string;
  /** Click handler (for non-link actions). */
  onClick?: React.MouseEventHandler<HTMLElement>;
  /** Visual variant for this action's button. */
  variant?: ButtonVariant;
  /** Link target — only used with `href`. */
  target?: React.HTMLAttributeAnchorTarget;
}

export interface CallToActionProps
  extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  /** Main heading. e.g. "Ready to ship faster?". */
  heading: React.ReactNode;
  /** Supporting line under the heading. */
  subtext?: React.ReactNode;
  /** Small eyebrow above the heading. e.g. "Get started". */
  eyebrow?: React.ReactNode;
  /** Primary action (rendered as a primary button). */
  primary?: CtaAction;
  /** Secondary action (rendered as a ghost/outline button). */
  secondary?: CtaAction;
  /** Use the premium brand-gradient surface instead of the soft accent tint. */
  gradient?: boolean;
}

/**
 * A centered conversion band. The heading is an <h2> so the band slots into a
 * page outline; actions become real <a> (when `href`) or <button> via the 20ui
 * Button, keeping the system focus ring and scale-on-press.
 */
export const CallToAction = React.forwardRef<HTMLElement, CallToActionProps>(
  function CallToAction(
    {
      heading,
      subtext,
      eyebrow,
      primary,
      secondary,
      gradient = false,
      className,
      ...rest
    },
    ref,
  ) {
    const cls = [
      'u-cta',
      gradient ? 'u-cta--gradient' : 'u-cta--soft',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <section ref={ref} className={cls} {...rest}>
        {gradient ? <span className="u-cta__aurora" aria-hidden="true" /> : null}
        <div className="u-cta__inner">
          {eyebrow != null ? (
            <span className="u-cta__eyebrow">{eyebrow}</span>
          ) : null}
          <h2 className="u-cta__heading">{heading}</h2>
          {subtext != null ? <p className="u-cta__subtext">{subtext}</p> : null}
          {(primary || secondary) && (
            <div className="u-cta__actions">
              {primary ? (
                <CtaButton action={primary} variant={primary.variant ?? 'primary'} />
              ) : null}
              {secondary ? (
                <CtaButton
                  action={secondary}
                  variant={secondary.variant ?? (gradient ? 'outline' : 'secondary')}
                />
              ) : null}
            </div>
          )}
        </div>
      </section>
    );
  },
);

function CtaButton({
  action,
  variant,
}: {
  action: CtaAction;
  variant: ButtonVariant;
}): React.JSX.Element {
  // A link action renders an <a> that *looks* like a button (reusing the same
  // u-btn classes) rather than nesting a real <button> inside an <a>, which
  // would be invalid HTML and a focus-order problem.
  if (action.href) {
    const relProps =
      action.target === '_blank' ? { rel: 'noreferrer noopener' } : undefined;
    const cls = ['u-btn', `u-btn--${variant}`, 'u-btn--lg', 'u-cta__link']
      .filter(Boolean)
      .join(' ');
    return (
      <a
        className={cls}
        href={action.href}
        target={action.target}
        {...relProps}
        onClick={action.onClick}
      >
        {variant === 'gradient' ? (
          <span className="u-btn__sheen" aria-hidden="true" />
        ) : null}
        <span className="u-btn__label">{action.label}</span>
      </a>
    );
  }
  return (
    <Button variant={variant} size="lg" onClick={action.onClick}>
      {action.label}
    </Button>
  );
}

/* ===========================================================================
   StatisticsCard — a big-number stat block (NOT StatCard, to avoid collision)
   =========================================================================== */

export interface StatisticsCardProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** The headline figure. e.g. "12,480" or "99.9%". */
  value: React.ReactNode;
  /** What the figure measures. e.g. "Messages delivered". */
  label: React.ReactNode;
  /** Optional supporting line under the label. */
  description?: React.ReactNode;
  /** Optional leading icon (decorative). */
  icon?: IconProp;
  /** Optional trend chip. e.g. { value: "+8.2%", tone: "up" }. */
  trend?: { value: React.ReactNode; tone?: 'up' | 'down' | 'neutral' };
  /** Center the contents (for stat-grid hero rows). */
  align?: 'start' | 'center';
}

/**
 * A large-figure stat block for marketing stat rows. The value reads as one
 * dense number; the label/description carry the meaning so the figure alone is
 * never the only signal. Renders as a plain block (compose inside a grid).
 */
export const StatisticsCard = React.forwardRef<HTMLDivElement, StatisticsCardProps>(
  function StatisticsCard(
    { value, label, description, icon, trend, align = 'start', className, ...rest },
    ref,
  ) {
    const cls = ['u-stats', `u-stats--${align}`, className]
      .filter(Boolean)
      .join(' ');
    return (
      <div ref={ref} className={cls} {...rest}>
        {icon ? (
          <span className="u-stats__icon" aria-hidden="true">
            {renderIcon(icon, { size: 18 })}
          </span>
        ) : null}
        <div className="u-stats__figure">
          <span className="u-stats__value">{value}</span>
          {trend ? (
            <span className={`u-stats__trend u-stats__trend--${trend.tone ?? 'neutral'}`}>
              {trend.value}
            </span>
          ) : null}
        </div>
        <span className="u-stats__label">{label}</span>
        {description != null ? (
          <span className="u-stats__desc">{description}</span>
        ) : null}
      </div>
    );
  },
);

/* ===========================================================================
   RouteComingSoon — centered placeholder for not-yet-built routes
   =========================================================================== */

export interface RouteComingSoonProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Headline. Defaults to "Coming soon". */
  title?: React.ReactNode;
  /** Supporting copy under the title. */
  description?: React.ReactNode;
  /** Icon for the badge. Defaults to a clock (decorative). */
  icon?: IconProp;
  /** Optional action node (e.g. a Button or link back). */
  action?: React.ReactNode;
}

/**
 * A friendly, centered placeholder for routes that are planned but not built
 * yet. The icon is decorative; the title carries the message. Lives in the
 * normal flow as a polite-status region so AT announces it once on mount.
 */
export const RouteComingSoon = React.forwardRef<HTMLDivElement, RouteComingSoonProps>(
  function RouteComingSoon(
    {
      title = 'Coming soon',
      description = 'This area is being built. Check back shortly to see it live.',
      icon = Clock,
      action,
      className,
      ...rest
    },
    ref,
  ) {
    return (
      <div
        ref={ref}
        className={['u-soon', className].filter(Boolean).join(' ')}
        role="status"
        {...rest}
      >
        <span className="u-soon__badge" aria-hidden="true">
          {renderIcon(icon, { size: 22 })}
        </span>
        <h2 className="u-soon__title">{title}</h2>
        {description != null ? (
          <p className="u-soon__desc">{description}</p>
        ) : null}
        {action != null ? <div className="u-soon__action">{action}</div> : null}
      </div>
    );
  },
);

export default CallToAction;
