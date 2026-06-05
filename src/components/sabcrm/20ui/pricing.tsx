'use client';

/**
 * 20ui — Pricing.
 *
 * A self-contained pricing card: plan name, a big formatted price, an
 * accessible feature list (ul/li with check icons), and a CTA that composes the
 * 20ui Button. The `highlighted` variant adds an accent border, a soft elevation
 * lift, and a "Most popular" badge (composes the 20ui Badge). Plus a convenience
 * PricingGrid that lays 2-4 cards out responsively.
 *
 * Emil polish: highlighted card lifts on hover (transform/opacity only, custom
 * ease, <250ms); reduced-motion disables it. A11y: features are a real list, the
 * price is announced as a group, decorative check/x icons are aria-hidden, and
 * the highlighted card is associated to its badge via aria-describedby.
 */

import * as React from 'react';
import { Check, Minus } from 'lucide-react';

import { Button } from './button';
import { Badge } from './badge';
import './pricing.css';

/** A single line in a plan's feature list. */
export interface PricingFeature {
  /** Feature text. Realistic demo strings live only in comments. */
  label: React.ReactNode;
  /** When false, the row reads as not-included (dimmed, dash icon). Default true. */
  included?: boolean;
}

/** The shape of one pricing plan. */
export interface PricingTier {
  /** Plan name, e.g. "Growth". */
  name: React.ReactNode;
  /** Headline price, pre-formatted by the caller, e.g. "$29" or "Free". */
  price: React.ReactNode;
  /** Period suffix beside the price, e.g. "/ month". */
  period?: React.ReactNode;
  /** Short tagline under the name. */
  description?: React.ReactNode;
  /** Feature rows shown with check / dash icons. */
  features?: Array<PricingFeature | string>;
  /**
   * The call to action. Pass a string for a default Button, or a full node
   * (e.g. your own <Button> / <a>) to take full control.
   */
  cta: React.ReactNode;
  /** Render as the recommended plan: accent border, lift, badge. */
  highlighted?: boolean;
}

export interface PricingCardProps
  extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  /** The plan to render. */
  tier: PricingTier;
  /** Badge text for the highlighted plan. Default "Most popular". */
  popularLabel?: React.ReactNode;
  /** Heading level for the plan name (keeps document outline sane). Default 3. */
  headingLevel?: 2 | 3 | 4 | 5;
}

function normalizeFeature(f: PricingFeature | string): PricingFeature {
  return typeof f === 'string' ? { label: f, included: true } : f;
}

/**
 * PricingCard — one plan. The card root is an <article>; the CTA is a 20ui
 * Button when `cta` is a string, otherwise the passed node is rendered as-is.
 */
export const PricingCard = React.forwardRef<HTMLElement, PricingCardProps>(
  function PricingCard(
    { tier, popularLabel = 'Most popular', headingLevel = 3, className, ...rest },
    ref,
  ) {
    const { name, price, period, description, features, cta, highlighted } = tier;
    // Stable ids so the card region can describe itself with the badge text.
    const reactId = React.useId();
    const badgeId = `${reactId}-popular`;
    const priceId = `${reactId}-price`;

    const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4' | 'h5';
    const rows = (features ?? []).map(normalizeFeature);

    const cls = [
      'u-pricing',
      highlighted && 'u-pricing--highlighted',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <article
        ref={ref}
        className={cls}
        aria-describedby={highlighted ? badgeId : undefined}
        {...rest}
      >
        {highlighted ? (
          <Badge
            id={badgeId}
            tone="accent"
            kind="solid"
            className="u-pricing__badge"
          >
            {popularLabel}
          </Badge>
        ) : null}

        <header className="u-pricing__head">
          <Heading className="u-pricing__name">{name}</Heading>
          {description != null ? (
            <p className="u-pricing__desc">{description}</p>
          ) : null}
        </header>

        <p className="u-pricing__price" id={priceId}>
          <span className="u-pricing__amount">{price}</span>
          {period != null ? (
            <span className="u-pricing__period">{period}</span>
          ) : null}
        </p>

        <div className="u-pricing__cta">
          {typeof cta === 'string' ? (
            <Button
              variant={highlighted ? 'primary' : 'secondary'}
              size="lg"
              block
            >
              {cta}
            </Button>
          ) : (
            cta
          )}
        </div>

        {rows.length > 0 ? (
          <ul className="u-pricing__features" aria-label="Plan features">
            {rows.map((f, i) => {
              const included = f.included !== false;
              return (
                <li
                  key={i}
                  className={
                    'u-pricing__feature' +
                    (included ? '' : ' u-pricing__feature--off')
                  }
                >
                  <span className="u-pricing__check" aria-hidden="true">
                    {included ? <Check size={13} /> : <Minus size={13} />}
                  </span>
                  <span className="u-pricing__feature-label">{f.label}</span>
                  {/* Carry inclusion to AT without relying on icon colour alone. */}
                  <span className="u-pricing__sr">
                    {included ? '(included)' : '(not included)'}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </article>
    );
  },
);

export interface PricingGridProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Pass <PricingCard /> elements as children. */
  children: React.ReactNode;
}

/**
 * PricingGrid — lays 2-4 PricingCards out in a responsive, equal-height row.
 * Column count derives from the child count so the unstyled call looks right.
 */
export function PricingGrid({
  children,
  className,
  ...rest
}: PricingGridProps): React.JSX.Element {
  const count = React.Children.count(children);
  const cols = Math.min(Math.max(count, 1), 4);
  const cls = ['u-pricing-grid', `u-pricing-grid--cols-${cols}`, className]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  );
}

export default PricingCard;
