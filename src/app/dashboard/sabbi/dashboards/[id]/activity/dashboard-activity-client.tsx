'use client';

import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

gsap.registerPlugin(useGSAP);

export function DashboardActivityClient({ children }: { children: React.ReactNode }) {
    const containerRef = useRef<HTMLDivElement>(null);

    useGSAP(
        () => {
            gsap.from(containerRef.current, {
                opacity: 0,
                y: 10,
                duration: 0.4,
                ease: 'power2.out',
            });
        },
        { scope: containerRef }
    );

    return (
        <div ref={containerRef} className="dashboard-activity-container">
            {children}
        </div>
    );
}
