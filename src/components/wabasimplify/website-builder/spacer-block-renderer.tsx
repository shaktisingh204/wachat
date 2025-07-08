
'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface SpacerBlockRendererProps {
  settings: {
    type?: 'spacer' | 'divider';
    height?: number;
    // Divider settings
    style?: 'solid' | 'dashed' | 'dotted';
    width?: string;
    thickness?: number;
    color?: string;
    alignment?: 'left' | 'center' | 'right';
    // Advanced settings
    margin?: { top?: number; bottom?: number };
    responsiveVisibility?: { desktop?: boolean; tablet?: boolean; mobile?: boolean };
  };
}

export const SpacerBlockRenderer: React.FC<SpacerBlockRendererProps> = ({ settings }) => {
    const type = settings.type || 'spacer';
    
    const responsiveClasses = cn({
        'max-lg:hidden': settings.responsiveVisibility?.desktop === false,
        'max-md:hidden lg:hidden': settings.responsiveVisibility?.tablet === false,
        'max-sm:hidden': settings.responsiveVisibility?.mobile === false,
    });
    
    const baseStyle: React.CSSProperties = {
        marginTop: settings.margin?.top ? `${settings.margin.top}px` : undefined,
        marginBottom: settings.margin?.bottom ? `${settings.margin.bottom}px` : undefined,
    };

    if (type === 'divider') {
        const dividerStyle: React.CSSProperties = {
            ...baseStyle,
            width: settings.width || '100%',
            borderTopStyle: settings.style || 'solid',
            borderTopWidth: `${settings.thickness || 1}px`,
            borderColor: settings.color || 'hsl(var(--border))',
        };
        
        const alignmentClass = {
            left: 'mr-auto',
            center: 'mx-auto',
            right: 'ml-auto',
        }[settings.alignment || 'center'];

        return <hr style={dividerStyle} className={cn(alignmentClass, responsiveClasses)} />;
    }

    // Spacer
    const spacerStyle: React.CSSProperties = {
        ...baseStyle,
        height: `${settings.height || 24}px`,
    };

    return <div style={spacerStyle} className={cn(responsiveClasses)}></div>;
};
