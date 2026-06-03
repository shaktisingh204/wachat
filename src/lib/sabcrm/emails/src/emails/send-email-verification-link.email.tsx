import { Trans } from '@lingui/react';
import { BaseEmail } from '@/lib/sabcrm/emails/src/components/BaseEmail';
import { CallToAction } from '@/lib/sabcrm/emails/src/components/CallToAction';
import { MainText } from '@/lib/sabcrm/emails/src/components/MainText';
import { Title } from '@/lib/sabcrm/emails/src/components/Title';
import { createI18nInstance } from '@/lib/sabcrm/emails/src/utils/i18n.utils';

type APP_LOCALES = Record<string, string>;

type SendEmailVerificationLinkEmailProps = {
  link: string;
  locale: keyof APP_LOCALES;
  isEmailUpdate?: boolean;
};

export const SendEmailVerificationLinkEmail = ({
  link,
  locale,
  isEmailUpdate = false,
}: SendEmailVerificationLinkEmailProps) => {
  const i18n = createI18nInstance(locale);
  const title = isEmailUpdate
    ? i18n._('Confirm your new email address')
    : i18n._('Confirm your email address');
  const bodyId = isEmailUpdate
    ? 'We received a request to change the email address associated with your SabCRM account. Click below to confirm this change.'
    : 'Thanks for registering for an account on SabCRM! Before we get started, we just need to confirm that this is you. Click below to verify your email address.';
  const ctaLabel = isEmailUpdate
    ? i18n._('Confirm new email')
    : i18n._('Verify Email');

  return (
    <BaseEmail width={333} locale={locale}>
      <Title value={title} />
      <MainText>
        <Trans id={bodyId} />
      </MainText>
      <br />
      <CallToAction href={link} value={ctaLabel} />
      <br />
      <br />
    </BaseEmail>
  );
};

SendEmailVerificationLinkEmail.PreviewProps = {
  link: 'https://app.sabnode.com/verify-email/123',
  locale: 'en',
  isEmailUpdate: false,
};

export default SendEmailVerificationLinkEmail;
