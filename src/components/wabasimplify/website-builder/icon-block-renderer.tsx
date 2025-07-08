
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
        size = 48, color, hoverColor, rotate, flipHorizontal, flipVertical,
        viewBackgroundColor, viewBorderWidth, viewBorderColor, viewPadding,
        viewHoverBackgroundColor, viewHoverBorderColor,
        hoverAnimation, transitionDuration = 0.3, border, boxShadow,
        margin, padding, zIndex, cssId, cssClasses, customCss, customAttributes, responsiveVisibility, animation, animationDuration, animationDelay,
        tabletAlign, mobileAlign, filter, hoverFilter, iconStyle = {},
    } = settings;

    // @ts-ignore
    const IconComponent = LucideIcons[icon] || LucideIcons.Star;
    const Tag = link ? 'a' : (settings.htmlTag || 'div');

    const uniqueId = cssId || React.useId().replace(/:/g, "");

    const getFilterString = (filterObj: any) => {
        if (!filterObj) return 'none';
        return `blur(${filterObj.blur || 0}px) brightness(${filterObj.brightness || 100}%) contrast(${filterObj.contrast || 100}%) saturate(${filterObj.saturate || 100}%) hue-rotate(${filterObj.hue || 0}deg)`;
    };
    
    const customStyleTag = (
        <style>{`
            #${uniqueId}:hover .icon-component {
                color: ${hoverColor || color};
            }
            #${uniqueId}:hover .view-wrapper {
                background-color: ${viewHoverBackgroundColor || viewBackgroundColor};
                border-color: ${viewHoverBorderColor || viewBorderColor};
            }
            #${uniqueId} .icon-component {
                filter: ${getFilterString(filter)};
            }
            #${uniqueId}:hover .icon-component {
                filter: ${getFilterString(hoverFilter)};
            }
            ${customCss || ''}
        `}</style>
    );

    const responsiveClasses = cn({
        'max-lg:hidden': responsiveVisibility?.desktop === false,
        'hidden md:max-lg:flex': responsiveVisibility?.tablet === false,
        'max-sm:hidden': responsiveVisibility?.mobile === false,
    });
    
    const animationClasses = {
        fadeIn: 'animate-in fade-in',
        fadeInUp: 'animate-in fade-in-0 slide-in-from-bottom-5',
        zoomIn: 'animate-in zoom-in-75',
        bounce: 'animate-bounce',
        none: '',
    }[animation || 'none'];
    
    const animationDurationClasses = { slow: 'duration-1000', normal: 'duration-500', fast: 'duration-300' }[animationDuration || 'normal'];

    const hoverAnimationClass = {
        grow: 'group-hover:scale-110', shrink: 'group-hover:scale-90', pulse: 'hover:animate-pulse', bob: 'animate-bob', wobbleHorizontal: 'animate-wobbleHorizontal',
        rotate: 'group-hover:rotate-180',
    }[hoverAnimation || 'none'];

    const wrapperStyle: React.CSSProperties = {
        display: 'flex',
        margin: margin ? `${margin.top || 0}px ${margin.right || 0}px ${margin.bottom || 0}px ${margin.left || 0}px` : undefined,
        padding: padding ? `${padding.top || 0}px ${padding.right || 0}px ${padding.bottom || 0}px ${padding.left || 0}px` : undefined,
        zIndex: zIndex || undefined,
        animationDelay: animationDelay ? `${animationDelay}ms` : undefined,
    };
    
    const responsiveAlignmentClasses = cn(
        'flex',
        { 'justify-start': align === 'left', 'justify-center': align === 'center', 'justify-end': align === 'right' },
        { 'md:justify-start': tabletAlign === 'left', 'md:justify-center': tabletAlign === 'center', 'md:justify-end': tabletAlign === 'right' },
        { 'sm:justify-start': mobileAlign === 'left', 'sm:justify-center': mobileAlign === 'center', 'sm:justify-end': mobileAlign === 'right' },
    );

    const viewStyle: React.CSSProperties = {
        display: 'inline-flex',
        padding: view !== 'none' ? `${viewPadding || 16}px` : undefined,
        backgroundColor: view !== 'none' ? viewBackgroundColor : undefined,
        borderStyle: view === 'framed' && border?.type !== 'none' ? (border?.type || 'solid') : undefined,
        borderColor: view === 'framed' ? viewBorderColor : undefined,
        borderTopWidth: view === 'framed' ? `${border?.width?.top || 0}px` : undefined,
        borderRightWidth: view === 'framed' ? `${border?.width?.right || 0}px` : undefined,
        borderBottomWidth: view === 'framed' ? `${border?.width?.bottom || 0}px` : undefined,
        borderLeftWidth: view === 'framed' ? `${border?.width?.left || 0}px` : undefined,
        borderRadius: view !== 'none' ? (shape === 'circle' ? '50%' : `${border?.radius?.tl || 0}px ${border?.radius?.tr || 0}px ${border?.radius?.br || 0}px ${border?.radius?.bl || 0}px`) : undefined,
        boxShadow: { sm: 'var(--tw-shadow)', md: 'var(--tw-shadow-md)', lg: 'var(--tw-shadow-lg)' }[boxShadow || 'none'],
        transition: `all ${transitionDuration}s ease-in-out`
    };

    const iconStyle: React.CSSProperties = {
        width: `${size}px`,
        height: `${size}px`,
        color: color || '#000000',
        transform: `rotate(${rotate || 0}deg) scaleX(${flipHorizontal ? -1 : 1}) scaleY(${flipVertical ? -1 : 1})`,
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

    return React.createElement(Tag, {
            id: uniqueId,
            className: cn('relative group/icon', responsiveAlignmentClasses, animationClasses, animationDurationClasses, responsiveClasses, cssClasses),
            style: wrapperStyle,
            ...customAttrs,
            ...(Tag === 'a' && linkProps)
        },
        customStyleTag,
        iconElement
    );
};
