
'use client';

import React from 'react';
import Link from 'next/link';
import * as LucideIcons from 'lucide-react';
import { cn } from '@/lib/utils';

interface IconBlockRendererProps {
  settings: any;
}

export const IconBlockRenderer: React.FC<IconBlockRendererProps> = ({ settings }) => {
    const {
        icon = 'Star', link, view = 'none', shape = 'circle', align = 'center',
        size = 48, color, hoverColor, rotate,
        viewBackgroundColor, viewBorderWidth, viewBorderColor, viewPadding, viewBorderRadius,
        viewHoverBackgroundColor, viewHoverBorderColor,
        hoverAnimation, transitionDuration = 0.3,
        margin, cssId, cssClasses, customCss, customAttributes, responsiveVisibility, animation
    } = settings;

    // @ts-ignore
    const IconComponent = LucideIcons[icon] || LucideIcons.Star;

    const uniqueId = cssId || React.useId().replace(/:/g, "");

    const customStyleTag = (
        <style>{`
            #${uniqueId}:hover .icon-component {
                color: ${hoverColor || color};
            }
            #${uniqueId}:hover .view-wrapper {
                background-color: ${viewHoverBackgroundColor || viewBackgroundColor};
                border-color: ${viewHoverBorderColor || viewBorderColor};
            }
            ${customCss || ''}
        `}</style>
    );

    const responsiveClasses = cn({
        'max-lg:hidden': responsiveVisibility?.desktop === false,
        'hidden md:max-lg:flex': responsiveVisibility?.tablet === false,
        'max-sm:hidden': responsiveVisibility?.mobile === false,
    });
    
    const animationClass = {
        fadeIn: 'animate-in fade-in',
        fadeInUp: 'animate-in fade-in-0 slide-in-from-bottom-5',
        zoomIn: 'animate-in zoom-in-75',
    }[animation || 'none'];

    const hoverAnimationClass = {
        grow: 'group-hover:scale-110',
        shrink: 'group-hover:scale-90',
        pulse: 'hover:animate-pulse',
        bob: 'hover:animate-bob',
        wobbleHorizontal: 'hover:animate-wobble-horizontal',
        rotate: 'group-hover:rotate-180',
    }[hoverAnimation || 'none'];
    
    const wrapperStyle: React.CSSProperties = {
        display: 'flex',
        justifyContent: align,
        margin: margin ? `${margin.top || 0}px ${margin.right || 0}px ${margin.bottom || 0}px ${margin.left || 0}px` : undefined,
    };
    
    const viewStyle: React.CSSProperties = {
        display: 'inline-flex',
        padding: view !== 'none' ? `${viewPadding || 16}px` : undefined,
        backgroundColor: view !== 'none' ? viewBackgroundColor : undefined,
        borderWidth: view === 'framed' ? `${viewBorderWidth || 2}px` : undefined,
        borderStyle: view === 'framed' ? 'solid' : undefined,
        borderColor: view === 'framed' ? viewBorderColor : undefined,
        borderRadius: view !== 'none' ? (shape === 'circle' ? '50%' : `${viewBorderRadius || 0}%`) : undefined,
        transition: `all ${transitionDuration}s ease-in-out`
    };

    const iconStyle: React.CSSProperties = {
        width: `${size}px`,
        height: `${size}px`,
        color: color || '#000000',
        transform: rotate ? `rotate(${rotate}deg)` : undefined,
        transition: `all ${transitionDuration}s ease-in-out`
    };

    const customAttrs = (customAttributes || []).reduce((acc: any, attr: any) => {
        if(attr.key) acc[attr.key] = attr.value;
        return acc;
    }, {});

    const iconElement = (
        <span className={cn('view-wrapper', hoverAnimationClass, 'inline-block transition-transform')} style={viewStyle}>
            <IconComponent style={iconStyle} className="icon-component" />
        </span>
    );
    
    const linkProps = {
      href: link || '#',
      ...(settings.linkNewWindow && { target: '_blank', rel: 'noopener noreferrer' }),
      ...(settings.linkNofollow && { rel: (settings.linkNewWindow ? 'noopener noreferrer ' : '') + 'nofollow' }),
    };

    const Tag = link ? 'a' : 'div';

    return (
        <div className={cn('relative group/icon', responsiveClasses, animationClass, cssClasses)} style={wrapperStyle} id={uniqueId} {...customAttrs}>
            {customStyleTag}
            <Tag {...(link ? linkProps : {})}>
                {iconElement}
            </Tag>
        </div>
    );
};
