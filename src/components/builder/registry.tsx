
import React from 'react';

// Placeholder components
const HeadingWidget = ({ content, style }: any) => <h2 style={ style }> { content.text } </h2>;
const TextWidget = ({ content, style }: any) => <p style={ style }> { content.text } </p>;
const ButtonWidget = ({ content, style }: any) => <button style={ style }> { content.text } </button>;
const ImageWidget = ({ content, style }: any) => <img src={ content.src } alt = "widget" style = { style } />;
const SpacerWidget = ({ style }: any) => <div style={{ height: '50px', ...style }} />;

export const WIDGET_REGISTRY: Record<string, React.FC<any>> = {
    HEADING: HeadingWidget,
    TEXT: TextWidget,
    BUTTON: ButtonWidget,
    IMAGE: ImageWidget,
    SPACER: SpacerWidget,
};

export const getWidgetComponent = (type: string) => {
    return WIDGET_REGISTRY[type] || (() => <div>Unknown Widget: { type } </div>);
};
