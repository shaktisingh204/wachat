'use client';

import * as React from 'react';
import { LazyMotion, domAnimation, MotionConfig } from 'motion/react';

/**
 * Wraps the entire app with a LazyMotion shell so the heavy
 * animation features only load when actually used. The
 * `domAnimation` feature pack covers the variants, transitions,
 * gestures and exit animations we use across primitives — without
 * pulling in 3D/layout features we never call.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
    return (
        <LazyMotion features={domAnimation} strict>
            <MotionConfig reducedMotion="user">
                {children}
            </MotionConfig>
        </LazyMotion>
    );
}
