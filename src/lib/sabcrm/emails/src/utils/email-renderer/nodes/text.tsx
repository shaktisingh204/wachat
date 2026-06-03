import { type JSONContent } from '@tiptap/core';
import { type ReactNode } from 'react';
import { renderMark } from '@/lib/sabcrm/emails/src/utils/email-renderer/renderers/render-mark';

// Inline guard — avoids twenty-shared dependency
const isDefined = <T,>(value: T | null | undefined): value is T =>
  value !== null && value !== undefined;

export const text = (node: JSONContent): ReactNode => {
  if (isDefined(node?.marks)) {
    return renderMark(node);
  }

  const { text: nodeText } = node;
  if (!isDefined(nodeText)) {
    return <>&nbsp;</>;
  }

  return <>{nodeText}</>;
};
