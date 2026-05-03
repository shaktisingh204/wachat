/**
 * SabNode Prism — motion presets.
 *
 * Reusable Variants and Transitions for the `motion` library
 * (a.k.a. framer-motion's modern package). Every primitive in the
 * design system reaches in here so animation feels coherent across
 * routes, modules, and components.
 *
 * Usage:
 *   import { motion } from 'motion/react';
 *   import { fadeInUp, springSoft } from '@/lib/motion';
 *
 *   <motion.div variants={fadeInUp} initial="hidden" animate="visible">
 */

import type { Transition, Variants } from 'motion/react';

/* ───────────────────────── Easing & transitions ───────────────────────── */

export const easeOut: Transition = {
    duration: 0.4,
    ease: [0.22, 1, 0.36, 1],
};

export const easeOutFast: Transition = {
    duration: 0.2,
    ease: [0.22, 1, 0.36, 1],
};

export const springSoft: Transition = {
    type: 'spring',
    stiffness: 260,
    damping: 24,
};

export const springSnappy: Transition = {
    type: 'spring',
    stiffness: 400,
    damping: 30,
};

/* ───────────────────────── Single-element variants ───────────────────────── */

export const fadeIn: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: easeOut },
};

export const fadeInUp: Variants = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: easeOut },
};

export const fadeInDown: Variants = {
    hidden: { opacity: 0, y: -12 },
    visible: { opacity: 1, y: 0, transition: easeOut },
};

export const scaleIn: Variants = {
    hidden: { opacity: 0, scale: 0.96 },
    visible: { opacity: 1, scale: 1, transition: springSoft },
};

export const slideInRight: Variants = {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0, transition: easeOut },
};

export const slideInLeft: Variants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0, transition: easeOut },
};

/* ───────────────────────── Stagger containers ───────────────────────── */

export const staggerContainer: Variants = {
    hidden: { opacity: 1 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.05,
            delayChildren: 0.04,
        },
    },
};

export const staggerItem: Variants = {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: easeOut },
};

/* ───────────────────────── Interaction primitives ───────────────────────── */

/**
 * Apply via `whileHover={hoverLift}`. Adds a subtle lift + scale
 * for cards, buttons, tiles. Pairs with `tapShrink`.
 */
export const hoverLift = {
    y: -2,
    scale: 1.01,
    transition: springSoft,
};

export const tapShrink = {
    scale: 0.97,
    transition: springSnappy,
};

/* ───────────────────────── Reduced motion helpers ───────────────────────── */

const noop: Variants = {
    hidden: { opacity: 1 },
    visible: { opacity: 1 },
};

/**
 * Returns a no-op Variants block when the user prefers reduced motion.
 * Falls back to `variants` otherwise. Safe to call on the server — it
 * always returns the source variants unless the browser API exists.
 */
export function prefersReducedMotion(variants: Variants): Variants {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return variants;
    }
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    return mql.matches ? noop : variants;
}

/**
 * Common pattern: spread these on any motion element to make it
 * mount-animate from hidden → visible.
 */
export const mountAnimation = {
    initial: 'hidden' as const,
    animate: 'visible' as const,
};
