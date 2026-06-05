'use client';

/**
 * 20ui — Content blocks.
 *
 * Marketing / careers building blocks composed from the rest of the system:
 *
 *  - FeatureCard         icon + title + description tile (variants: default / soft / outline)
 *  - FeatureGrid         responsive grid of features (from a `features[]` prop or children)
 *  - TestimonialCard     quote (clamped to 3 lines) + author name / role / avatar
 *  - TestimonialsColumns multi-column "wall of love" marquee, paused on hover, static
 *                        for reduced-motion users
 *  - JobListing          a single careers card: title, location, type, chip row, apply CTA
 *
 * All motion is transform / opacity only on the custom `--u-ease-out`; the marquee
 * is pure CSS so it carries no runtime animation dependency. Reduced-motion users
 * get a static, fully-readable layout (the `@media` block in blocks.css freezes it).
 */

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { MapPin, Briefcase, ArrowRight, Quote } from 'lucide-react';

import { Avatar } from './avatar';
import { Button } from './button';

import './blocks.css';

/* ---------------------------------------------------------------- FeatureCard */

export type FeatureCardVariant = 'default' | 'soft' | 'outline';

export interface FeatureCardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Leading icon — a lucide component (rendered) or any node. */
  icon?: LucideIcon | React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Visual treatment. */
  variant?: FeatureCardVariant;
}

function isLucideIcon(icon: unknown): icon is LucideIcon {
  // lucide icons are forwardRef render functions (functions / objects with $$typeof),
  // whereas already-rendered nodes are elements. Treat plain functions as components.
  return typeof icon === 'function' || (typeof icon === 'object' && icon !== null && '$$typeof' in (icon as object) && !React.isValidElement(icon));
}

/** A single feature tile: icon chip, title, supporting copy. */
export function FeatureCard({
  icon,
  title,
  description,
  variant = 'default',
  className,
  children,
  ...rest
}: FeatureCardProps): React.JSX.Element {
  const cls = ['u-feature-card', `u-feature-card--${variant}`, className]
    .filter(Boolean)
    .join(' ');

  let iconNode: React.ReactNode = null;
  if (icon) {
    if (isLucideIcon(icon)) {
      const Icon = icon as LucideIcon;
      iconNode = <Icon size={18} aria-hidden="true" />;
    } else {
      iconNode = icon;
    }
  }

  return (
    <div className={cls} {...rest}>
      {iconNode != null ? (
        <span className="u-feature-card__icon" aria-hidden="true">
          {iconNode}
        </span>
      ) : null}
      <h3 className="u-feature-card__title">{title}</h3>
      {description != null ? (
        <p className="u-feature-card__desc">{description}</p>
      ) : null}
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------- FeatureGrid */

export interface FeatureItem {
  /** Stable key; falls back to the index when absent. */
  id?: string;
  icon?: LucideIcon | React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  variant?: FeatureCardVariant;
}

export interface FeatureGridProps
  extends React.HTMLAttributes<HTMLElement> {
  /** Column count at the wide breakpoint. */
  columns?: 2 | 3 | 4;
  /** Optional headline above the grid. */
  heading?: React.ReactNode;
  /** Optional sub-head paragraph under the heading. */
  subhead?: React.ReactNode;
  /** Data-driven cards. When omitted, render <FeatureCard /> children instead. */
  features?: FeatureItem[];
  /** Shared variant applied to every data-driven card (per-item wins). */
  variant?: FeatureCardVariant;
  children?: React.ReactNode;
}

/**
 * Responsive grid of {@link FeatureCard}s. Pass a `features[]` array for the
 * data-driven path, or compose `<FeatureCard />` children directly.
 *
 * e.g. features={[{ icon: Zap, title: "Realtime sync", description: "Changes land in under a second." }]}
 */
export function FeatureGrid({
  columns = 3,
  heading,
  subhead,
  features,
  variant,
  className,
  children,
  ...rest
}: FeatureGridProps): React.JSX.Element {
  const headingId = React.useId();
  const labelled = heading != null;
  const cls = ['u-feature-grid', className].filter(Boolean).join(' ');

  return (
    <section
      className={cls}
      aria-labelledby={labelled ? headingId : undefined}
      {...rest}
    >
      {heading != null || subhead != null ? (
        <header className="u-feature-grid__head">
          {heading != null ? (
            <h2 id={headingId} className="u-feature-grid__heading">
              {heading}
            </h2>
          ) : null}
          {subhead != null ? (
            <p className="u-feature-grid__subhead">{subhead}</p>
          ) : null}
        </header>
      ) : null}
      <div
        className={`u-feature-grid__items u-feature-grid__items--${columns}`}
      >
        {features
          ? features.map((f, i) => (
              <FeatureCard
                key={f.id ?? i}
                icon={f.icon}
                title={f.title}
                description={f.description}
                variant={f.variant ?? variant ?? 'default'}
              />
            ))
          : children}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- TestimonialCard */

export interface Testimonial {
  /** Stable key for list rendering. */
  id?: string;
  /** The quote. Visually clamped to 3 lines. */
  quote: React.ReactNode;
  /** Author display name — also drives the avatar fallback initials. */
  name: string;
  /** Author role / company line. */
  role?: React.ReactNode;
  /** Optional avatar image URL; falls back to deterministic initials. */
  avatar?: string;
}

export interface TestimonialCardProps
  extends React.HTMLAttributes<HTMLElement> {
  testimonial: Testimonial;
}

/** A quote card: clamped quote + author name / role / avatar. */
export function TestimonialCard({
  testimonial,
  className,
  ...rest
}: TestimonialCardProps): React.JSX.Element {
  const { quote, name, role, avatar } = testimonial;
  return (
    <figure
      className={['u-testimonial', className].filter(Boolean).join(' ')}
      {...rest}
    >
      <Quote className="u-testimonial__mark" size={16} aria-hidden="true" />
      <blockquote className="u-testimonial__quote">{quote}</blockquote>
      <figcaption className="u-testimonial__author">
        <Avatar name={name} src={avatar} size="sm" shape="round" />
        <span className="u-testimonial__meta">
          <span className="u-testimonial__name">{name}</span>
          {role != null ? (
            <span className="u-testimonial__role">{role}</span>
          ) : null}
        </span>
      </figcaption>
    </figure>
  );
}

/* --------------------------------------------------------- TestimonialsColumns */

export interface TestimonialsColumnsProps
  extends React.HTMLAttributes<HTMLDivElement> {
  testimonials: Testimonial[];
  /** Number of columns; quotes are dealt round-robin across them. */
  columns?: 2 | 3 | 4;
  /**
   * Auto-scroll the columns as a vertical marquee. When false (or when the user
   * prefers reduced motion) it renders as a plain, scrollable multi-column wall.
   */
  marquee?: boolean;
  /** Base loop duration in seconds (alternating columns run a touch slower). */
  duration?: number;
  /** Viewport height for the marquee. Ignored when `marquee` is false. */
  height?: number | string;
}

/**
 * Multi-column testimonial wall. With `marquee` on, each column auto-scrolls
 * (alternating direction + speed) and pauses on hover; the track is duplicated so
 * the loop is seamless. Reduced-motion users always get the static wall — the
 * `@media (prefers-reduced-motion: reduce)` block in blocks.css freezes every
 * column and restores natural height, so nothing important scrolls out of reach.
 */
export function TestimonialsColumns({
  testimonials,
  columns = 3,
  marquee = true,
  duration = 32,
  height = 560,
  className,
  ...rest
}: TestimonialsColumnsProps): React.JSX.Element {
  const cols = React.useMemo(() => {
    const buckets: Testimonial[][] = Array.from(
      { length: columns },
      () => [],
    );
    testimonials.forEach((t, i) => {
      buckets[i % columns].push(t);
    });
    return buckets;
  }, [testimonials, columns]);

  const cls = [
    'u-tcolumns',
    `u-tcolumns--${columns}`,
    marquee && 'u-tcolumns--marquee',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={cls}
      style={marquee ? { height } : undefined}
      {...rest}
    >
      {cols.map((col, colIndex) => {
        // Alternate columns scroll the opposite direction at slightly varied
        // speeds for the organic "wall" feel.
        const dir = colIndex % 2 === 0 ? 'down' : 'up';
        const dur = duration + colIndex * 4;
        return (
          <div
            key={colIndex}
            className={`u-tcolumns__col u-tcolumns__col--${dir}`}
            style={
              marquee
                ? ({ '--u-marquee-dur': `${dur}s` } as React.CSSProperties)
                : undefined
            }
          >
            <div className="u-tcolumns__track">
              {/* The track is duplicated for a seamless wrap; the clone is
                  aria-hidden so screen readers read each quote exactly once. */}
              {col.map((t, i) => (
                <TestimonialCard
                  key={t.id ?? `a-${i}`}
                  testimonial={t}
                  className="u-tcolumns__card"
                />
              ))}
              {marquee
                ? col.map((t, i) => (
                    <TestimonialCard
                      key={t.id ? `clone-${t.id}` : `b-${i}`}
                      testimonial={t}
                      className="u-tcolumns__card"
                      aria-hidden="true"
                    />
                  ))
                : null}
            </div>
          </div>
        );
      })}
      {marquee ? (
        <>
          <span className="u-tcolumns__fade u-tcolumns__fade--top" aria-hidden="true" />
          <span className="u-tcolumns__fade u-tcolumns__fade--bottom" aria-hidden="true" />
        </>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------------- JobListing */

export interface JobListingProps
  extends Omit<React.HTMLAttributes<HTMLElement>, 'title' | 'onClick'> {
  title: React.ReactNode;
  /** e.g. "London, UK" or "Remote". */
  location?: React.ReactNode;
  /** e.g. "Full time", "Contract". */
  type?: React.ReactNode;
  /** Optional team / department line above the title. */
  department?: React.ReactNode;
  /** Optional short blurb under the title. */
  description?: React.ReactNode;
  /** Pill row of attributes (e.g. ["TypeScript", "Hybrid", "Senior"]). */
  chips?: string[];
  /** Apply CTA label. */
  applyLabel?: string;
  /** Apply CTA href — renders an anchor when set. */
  applyHref?: string;
  /** Apply CTA handler — used when no href is given. */
  onApply?: () => void;
}

/**
 * A single careers card: department / title, location + type meta, a chip row,
 * and an "Apply" CTA. The whole card is a hairline tile that lifts on hover; the
 * CTA is a real link (when `applyHref` is set) or a button, so keyboard and
 * screen-reader users reach it directly.
 *
 * e.g. <JobListing title="Senior Frontend Engineer" location="Remote" type="Full time"
 *        department="Engineering" chips={["React", "TypeScript", "Design systems"]}
 *        applyHref="/careers/frontend" />
 */
export function JobListing({
  title,
  location,
  type,
  department,
  description,
  chips,
  applyLabel = 'Apply',
  applyHref,
  onApply,
  className,
  ...rest
}: JobListingProps): React.JSX.Element {
  const cls = ['u-job', className].filter(Boolean).join(' ');
  const titleId = React.useId();

  return (
    <article className={cls} aria-labelledby={titleId} {...rest}>
      <div className="u-job__main">
        {department != null ? (
          <p className="u-job__dept">{department}</p>
        ) : null}
        <h3 id={titleId} className="u-job__title">
          {title}
        </h3>
        {description != null ? (
          <p className="u-job__desc">{description}</p>
        ) : null}
        <div className="u-job__meta">
          {location != null ? (
            <span className="u-job__metaitem">
              <MapPin size={13} aria-hidden="true" />
              {location}
            </span>
          ) : null}
          {type != null ? (
            <span className="u-job__metaitem">
              <Briefcase size={13} aria-hidden="true" />
              {type}
            </span>
          ) : null}
        </div>
        {chips && chips.length > 0 ? (
          <ul className="u-job__chips">
            {chips.map((chip, i) => (
              <li key={`${chip}-${i}`} className="u-job__chip">
                {chip}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="u-job__cta">
        {applyHref ? (
          <a
            className="u-job__apply"
            href={applyHref}
            aria-label={
              typeof title === 'string' ? `${applyLabel} for ${title}` : applyLabel
            }
          >
            <span className="u-job__apply-label">{applyLabel}</span>
            <ArrowRight size={14} aria-hidden="true" />
          </a>
        ) : (
          <Button
            variant="primary"
            size="sm"
            iconRight={ArrowRight}
            onClick={onApply}
            aria-label={
              typeof title === 'string' ? `${applyLabel} for ${title}` : applyLabel
            }
          >
            {applyLabel}
          </Button>
        )}
      </div>
    </article>
  );
}

export default FeatureGrid;
