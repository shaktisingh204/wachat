'use client';

import { Button, type ButtonSize } from '@/components/sabcrm/20ui';
import { cn } from '@/lib/utils';
import * as LucideIcons from 'lucide-react';

import React from 'react';
import Link from 'next/link';

interface ButtonBlockRendererProps {
  settings: any;
}

export const ButtonBlockRenderer: React.FC<ButtonBlockRendererProps> = ({ settings }) => {
    const safeSettings = settings || {};
    const {
        text, link, linkNewWindow, linkNofollow, htmlTag = 'a', align, size = 'default',
        icon, iconPosition = 'left', iconSpacing = 8, typography = {}, color, backgroundColor,
        border, padding, hover, boxShadow, transitionDuration = 0.3, iconStyle = {},
        animation, animationDuration = 'normal', animationDelay, responsiveVisibility, cssId, cssClasses, customCss, customAttributes,
        tabletAlign, mobileAlign
    } = safeSettings;

    const renderAsLink = Boolean(link);

    const alignmentClasses = {
        left: 'justify-start', center: 'justify-center', right: 'justify-end', justify: 'justify-stretch',
    };

    const responsiveClasses = cn(
        'flex w-full',
        alignmentClasses[align as keyof typeof alignmentClasses] || 'justify-start',
        {
          'md:justify-start': tabletAlign === 'left',
          'md:justify-center': tabletAlign === 'center',
          'md:justify-end': tabletAlign === 'right',
        },
        {
          'sm:justify-start': mobileAlign === 'left',
          'sm:justify-center': mobileAlign === 'center',
          'sm:justify-end': mobileAlign === 'right',
        },
        {
            'max-lg:hidden': responsiveVisibility?.desktop === false,
            'max-md:hidden lg:hidden': responsiveVisibility?.tablet === false,
            'max-sm:hidden': responsiveVisibility?.mobile === false,
        }
    );

    const animationClasses = {
        fade: 'animate-in fade-in',
        'slide-up': 'animate-in fade-in-0 slide-in-from-bottom-5',
        none: '',
    };
    const animationDurationClasses = { slow: 'duration-1000', normal: 'duration-500', fast: 'duration-300' };

    const hoverAnimationClass = ({
        grow: 'hover:scale-110', shrink: 'hover:scale-90', pulse: 'hover:animate-pulse', bob: 'hover:animate-bob', wobbleHorizontal: 'hover:animate-wobbleHorizontal',
    } as Record<string, string>)[hover?.animation || 'none'] || '';

    const customAttrs = (customAttributes || []).reduce((acc: any, attr: any) => {
        if(attr.key) acc[attr.key] = attr.value;
        return acc;
    }, {});

    const reactId = React.useId().replace(/:/g, "");
    const uniqueId = cssId || reactId;

    const customStyleTag = (
      <style>{`
        #${uniqueId} {
            color: ${color};
            background-color: ${backgroundColor};
            font-family: ${typography.fontFamily || 'inherit'};
            font-size: ${typography.fontSize ? `${typography.fontSize}px` : 'inherit'};
            font-weight: ${typography.fontWeight || 'normal'};
            text-transform: ${typography.textTransform || 'none'};
            font-style: ${typography.fontStyle || 'normal'};
            text-decoration: ${typography.textDecoration || 'none'};
            line-height: ${typography.lineHeight || 'normal'};
            letter-spacing: ${typography.letterSpacing ? `${typography.letterSpacing}px` : 'normal'};
            padding: ${padding ? `${padding.top || 0}px ${padding.right || 0}px ${padding.bottom || 0}px ${padding.left || 0}px` : ''};
            border-style: ${border?.type || 'none'};
            border-width: ${border?.width ? `${border.width.top || 0}px ${border.width.right || 0}px ${border.width.bottom || 0}px ${border.width.left || 0}px` : '0'};
            border-color: ${border?.color};
            border-radius: ${border?.radius ? `${border.radius.tl || 0}px ${border.radius.tr || 0}px ${border.radius.br || 0}px ${border.radius.bl || 0}px` : '0.5rem'};
            box-shadow: ${boxShadow?.type === 'inset' ? 'inset ' : ''} ${boxShadow?.x || 0}px ${boxShadow?.y || 0}px ${boxShadow?.blur || 0}px ${boxShadow?.spread || 0}px ${boxShadow?.color || 'transparent'};
            transition: all ${transitionDuration}s ease-in-out;
            gap: ${iconSpacing ? `${iconSpacing}px` : '0'};
            ${animationDelay ? `animation-delay: ${animationDelay}ms;` : ''}
            ${customCss || ''}
        }
        #${uniqueId}:hover {
            color: ${hover?.color || color};
            background-color: ${hover?.backgroundColor || backgroundColor};
            border-color: ${hover?.border?.color || border?.color};
            box-shadow: ${hover?.boxShadow?.type === 'inset' ? 'inset ' : ''} ${hover?.boxShadow?.x || boxShadow?.x || 0}px ${hover?.boxShadow?.y || boxShadow?.y || 0}px ${hover?.boxShadow?.blur || boxShadow?.blur || 0}px ${hover?.boxShadow?.spread || boxShadow?.spread || 0}px ${hover?.boxShadow?.color || boxShadow?.color || 'transparent'};
        }
         #${uniqueId}:hover .icon-component {
            color: ${hover?.iconColor || iconStyle?.color || hover?.color};
        }
    `}</style>
    );

    // @ts-ignore
    const IconComponent = icon && LucideIcons[icon] ? LucideIcons[icon] : null;

    const iconElement = IconComponent ? (
        <IconComponent
            className="icon-component"
            aria-hidden="true"
            style={{
                width: iconStyle.size ? `${iconStyle.size}px` : '1em',
                height: iconStyle.size ? `${iconStyle.size}px` : '1em',
                color: iconStyle.color || 'inherit'
            }}
        />
    ) : null;

    const content = (
      <>
        {iconPosition === 'left' && iconElement}
        <span>{text}</span>
        {iconPosition === 'right' && iconElement}
      </>
    );

    const sizeMap: Record<string, ButtonSize> = { default: 'md', sm: 'sm', md: 'md', lg: 'lg' };
    const buttonSize: ButtonSize = sizeMap[size as string] || 'md';

    // 20ui base button classes (mirror the Button component) so the anchor variant
    // matches the native-button variant. Runtime visuals come from the #uniqueId style.
    const baseButtonClasses = cn(
        'u-btn',
        'u-btn--secondary',
        `u-btn--${buttonSize}`,
        animationClasses[animation as keyof typeof animationClasses],
        animationDurationClasses[animationDuration as keyof typeof animationDurationClasses],
        hoverAnimationClass,
        cssClasses
    );

    return (
        <div className={cn('ui20', responsiveClasses)}>
            {customStyleTag}
            {renderAsLink ? (
                <Link
                    id={uniqueId}
                    href={link}
                    target={linkNewWindow ? '_blank' : '_self'}
                    rel={linkNofollow ? 'nofollow' : undefined}
                    className={baseButtonClasses}
                    {...customAttrs}
                >
                    {content}
                </Link>
            ) : (
                <Button
                    id={uniqueId}
                    variant="secondary"
                    size={buttonSize}
                    className={cn(
                        animationClasses[animation as keyof typeof animationClasses],
                        animationDurationClasses[animationDuration as keyof typeof animationDurationClasses],
                        hoverAnimationClass,
                        cssClasses,
                    )}
                    {...customAttrs}
                >
                    {content}
                </Button>
            )}
        </div>
    );
};
