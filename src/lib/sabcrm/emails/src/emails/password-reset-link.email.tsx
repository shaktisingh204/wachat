import { Trans } from '@lingui/react';
import { BaseEmail } from '@/lib/sabcrm/emails/src/components/BaseEmail';
import { CallToAction } from '@/lib/sabcrm/emails/src/components/CallToAction';
import { Link } from '@/lib/sabcrm/emails/src/components/Link';
import { MainText } from '@/lib/sabcrm/emails/src/components/MainText';
import { Title } from '@/lib/sabcrm/emails/src/components/Title';
import { createI18nInstance } from '@/lib/sabcrm/emails/src/utils/i18n.utils';

// APP_LOCALES type — inline to avoid twenty-shared dependency
type APP_LOCALES = Record<string, string>;

type PasswordResetLinkEmailProps = {
  duration: string;
  hasPassword: boolean;
  link: string;
  locale: keyof APP_LOCALES;
};

export const PasswordResetLinkEmail = ({
  duration,
  hasPassword,
  link,
  locale,
}: PasswordResetLinkEmailProps) => {
  const i18n = createI18nInstance(locale);
  const headline = hasPassword
    ? i18n._('Reset your password 🗝')
    : i18n._('Set your password 🗝');
  const ctaLabel = hasPassword ? i18n._('Reset') : i18n._('Set');

  return (
    <BaseEmail locale={locale}>
      <Title value={headline} />
      <MainText>
        <Trans
          id="This link is only valid for the next {duration}. If the link does not work, you can use the login verification link directly:"
          values={{ duration }}
        />
        <br />
        <Link href={link} value={link} />
      </MainText>
      <br />
      <CallToAction href={link} value={ctaLabel} />
      <br />
      <br />
    </BaseEmail>
  );
};

PasswordResetLinkEmail.PreviewProps = {
  duration: '24 hours',
  hasPassword: true,
  link: 'https://app.sabnode.com/reset-password/123',
  locale: 'en',
} as PasswordResetLinkEmailProps;

export default PasswordResetLinkEmail;
