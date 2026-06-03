import { BaseEmail } from '@/lib/sabcrm/emails/src/components/BaseEmail';
import { Title } from '@/lib/sabcrm/emails/src/components/Title';
import { createI18nInstance } from '@/lib/sabcrm/emails/src/utils/i18n.utils';

type APP_LOCALES = Record<string, string>;

type TestEmailProps = {
  locale: keyof APP_LOCALES;
};

// This is a test email which isn't used in production
// It's useful to do tests and play in a local environment
export const TestEmail = ({ locale }: TestEmailProps) => {
  const i18n = createI18nInstance(locale);

  return (
    <BaseEmail locale={locale}>
      <Title value={i18n._('Test email')} />
      <br />
      <br />
    </BaseEmail>
  );
};

TestEmail.PreviewProps = {
  locale: 'en',
};

export default TestEmail;
