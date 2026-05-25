'use client';

import React, { useMemo, useState, useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

interface FunnelStep {
    id: string;
    label: string;
    value: number;
    color: string;
}

export function FunnelChart({ data }: { data: FunnelStep[] }) {
    const [hovered, setHovered] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const maxVal = Math.max(...data.map(d => d.value));
    
    // Calculate polygons for funnel
    const width = 500;
    const height = 300;
    const rowHeight = height / data.length;
    const gap = 4;

    const polygons = useMemo(() => {
        return data.map((step, i) => {
            const isLast = i === data.length - 1;
            
            const currentWidth = (step.value / maxVal) * width;
            const nextWidth = isLast ? currentWidth * 0.7 : (data[i + 1].value / maxVal) * width;

            const topY = i * rowHeight + gap;
            const bottomY = topY + rowHeight - gap * 2;

            const topLeftX = (width - currentWidth) / 2;
            const topRightX = width - topLeftX;
            const bottomLeftX = (width - nextWidth) / 2;
            const bottomRightX = width - bottomLeftX;

            return {
                ...step,
                points: `${topLeftX},${topY} ${topRightX},${topY} ${bottomRightX},${bottomY} ${bottomLeftX},${bottomY}`,
                midY: topY + (rowHeight - gap * 2) / 2,
            };
        });
    }, [data, maxVal, width, rowHeight]);

    useGSAP(() => {
        gsap.from('.funnel-polygon', {
            duration: 0.8,
            scaleY: 0,
            transformOrigin: 'top center',
            stagger: 0.15,
            ease: 'power3.out',
            clearProps: 'all'
        });
        
        gsap.from('.funnel-text', {
            duration: 0.6,
            opacity: 0,
            y: -10,
            stagger: 0.15,
            delay: 0.3,
            ease: 'power2.out',
            clearProps: 'all'
        });

        gsap.from('.funnel-dropoff', {
            duration: 0.4,
            opacity: 0,
            x: -20,
            stagger: 0.15,
            delay: 0.5,
            ease: 'back.out(1.5)',
            clearProps: 'all'
        });
    }, { scope: containerRef, dependencies: [data] });

    return (
        <div ref={containerRef} className="flex flex-col items-center w-full">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible font-sans drop-shadow-sm">
                {polygons.map((p, i) => {
                    const prevValue = i > 0 ? data[i - 1].value : null;
                    const dropOffRate = prevValue ? Math.round((p.value / prevValue) * 100) : null;
                    
                    return (
                        <React.Fragment key={p.id}>
                            <g 
                                onMouseEnter={() => setHovered(p.id)}
                                onMouseLeave={() => setHovered(null)}
                                className="cursor-pointer transition-opacity duration-200"
                                style={{ opacity: hovered && hovered !== p.id ? 0.4 : 1 }}
                            >
                                <polygon 
                                    points={p.points} 
                                    fill={p.color} 
                                    className="funnel-polygon transition-all duration-300 hover:brightness-110"
                                />
                                <text 
                                    x={width / 2} 
                                    y={p.midY} 
                                    textAnchor="middle" 
                                    alignmentBaseline="middle"
                                    fill="white"
                                    fontSize="14"
                                    fontWeight="600"
                                    className="funnel-text pointer-events-none drop-shadow-md"
                                >
                                    {p.label} - {p.value}
                                </text>
                            </g>
                            
                            {dropOffRate !== null && (
                                <g className="funnel-dropoff pointer-events-none">
                                    <rect 
                                        x={width - 60} 
                                        y={p.midY - rowHeight / 2 - 12} 
                                        width="50" 
                                        height="24" 
                                        rx="12" 
                                        fill="var(--zoru-surface-2)" 
                                        stroke="var(--zoru-line)"
                                    />
                                    <text 
                                        x={width - 35} 
                                        y={p.midY - rowHeight / 2 + 1} 
                                        textAnchor="middle" 
                                        alignmentBaseline="middle"
                                        fill="var(--zoru-ink-muted)"
                                        fontSize="11"
                                        fontWeight="500"
                                    >
                                        {dropOffRate}%
                                    </text>
                                </g>
                            )}
                        </React.Fragment>
                    );
                })}
            </svg>
        </div>
    );
}
