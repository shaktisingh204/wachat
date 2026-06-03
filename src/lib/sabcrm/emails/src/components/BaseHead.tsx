// Ported from twenty-emails/src/components/BaseHead.tsx
// Fixed import to relative path for common-style

import { Font, Head } from '@react-email/components';

import { emailTheme } from '../common-style';

export const BaseHead = () => {
  return (
    <Head>
      <title>SabCRM email</title>
      <Font
        fontFamily={emailTheme.font.family}
        fallbackFontFamily="sans-serif"
        fontStyle="normal"
        fontWeight={emailTheme.font.weight.regular}
      />
    </Head>
  );
};
