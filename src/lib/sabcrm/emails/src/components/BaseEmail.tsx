// Ported from twenty-emails/src/components/BaseEmail.tsx
// Fixed imports to target paths; removed twenty-shared external dep for APP_LOCALES

import { I18nProvider } from '@lingui/react';
import { Container, Html } from '@react-email/components';
import { type JSX } from 'react';

import { APP_LOCALES } from '@/lib/sabcrm/emails/lingui.config';
import { BaseHead } from './BaseHead';
import { Footer } from './Footer';
import { Logo } from './Logo';
import { createI18nInstance } from '../utils/i18n.utils';

type BaseEmailProps = {
  children: JSX.Element | JSX.Element[] | string;
  width?: number;
  locale: keyof typeof APP_LOCALES;
};

export const BaseEmail = ({ children, width, locale }: BaseEmailProps) => {
  const i18nInstance = createI18nInstance(locale);

  return (
    <I18nProvider i18n={i18nInstance}>
      <Html lang={locale}>
        <BaseHead />
        <Container width={width ?? 290}>
          <Logo />
          {children}
          <Footer i18n={i18nInstance} />
        </Container>
      </Html>
    </I18nProvider>
  );
};
