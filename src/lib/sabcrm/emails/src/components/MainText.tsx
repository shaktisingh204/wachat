// Ported from twenty-emails/src/components/MainText.tsx
// Fixed import to relative path for common-style

import { Text } from '@react-email/components';
import { type JSX } from 'react';

import { emailTheme } from '../common-style';

type MainTextProps = {
  children: JSX.Element | JSX.Element[] | string;
};

const mainTextStyle = {
  fontFamily: emailTheme.font.family,
  fontSize: emailTheme.font.size.md,
  fontWeight: emailTheme.font.weight.regular,
  color: emailTheme.font.colors.primary,
  lineHeight: emailTheme.font.lineHeight,
};

export const MainText = ({ children }: MainTextProps) => {
  return <Text style={mainTextStyle}>{children}</Text>;
};
