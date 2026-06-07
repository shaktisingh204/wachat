'use client';

import React from 'react';
import { Button } from '@/components/sabcrm/20ui';

// Placeholder widget renderers for the page builder.
// `content` and `style` are runtime data supplied by the builder editor:
// `style` is the user-picked CSS object (element.style) and is therefore a
// genuinely runtime-computed value applied inline.

const HeadingWidget = ({ content, style }: any) => <h2 style={style}>{content.text}</h2>;

const TextWidget = ({ content, style }: any) => <p style={style}>{content.text}</p>;

const ButtonWidget = ({ content, style }: any) => (
  <Button variant="primary" style={style}>
    {content.text}
  </Button>
);

const ImageWidget = ({ content, style }: any) => (
  <img src={content.src} alt={content.alt || 'Image widget'} style={style} />
);

const SpacerWidget = ({ style }: any) => <div className="h-[50px]" style={style} />;

export const WIDGET_REGISTRY: Record<string, React.FC<any>> = {
  HEADING: HeadingWidget,
  TEXT: TextWidget,
  BUTTON: ButtonWidget,
  IMAGE: ImageWidget,
  SPACER: SpacerWidget,
};

export const getWidgetComponent = (type: string) => {
  return (
    WIDGET_REGISTRY[type] ||
    (() => (
      <div className="text-sm text-[var(--st-text-secondary)]">Unknown Widget: {type}</div>
    ))
  );
};
