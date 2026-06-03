import { type JSONContent } from '@tiptap/core';
import { type ReactNode } from 'react';

// Inline guard — avoids twenty-shared dependency
const isDefined = <T,>(value: T | null | undefined): value is T =>
  value !== null && value !== undefined;

export const variableTag = (node: JSONContent): ReactNode => {
  const { variable } = node?.attrs || {};
  if (!isDefined(variable)) {
    return <>&nbsp;</>;
  }

  return <>{variable}</>;
};
