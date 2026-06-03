import { Trans } from '@lingui/react';
import { Img } from '@react-email/components';
import { emailTheme } from '@/lib/sabcrm/emails/src/common-style';
import { BaseEmail } from '@/lib/sabcrm/emails/src/components/BaseEmail';
import { CallToAction } from '@/lib/sabcrm/emails/src/components/CallToAction';
import { HighlightedContainer } from '@/lib/sabcrm/emails/src/components/HighlightedContainer';
import { HighlightedText } from '@/lib/sabcrm/emails/src/components/HighlightedText';
import { Link } from '@/lib/sabcrm/emails/src/components/Link';
import { MainText } from '@/lib/sabcrm/emails/src/components/MainText';
import { Title } from '@/lib/sabcrm/emails/src/components/Title';
import { DEFAULT_WORKSPACE_LOGO } from '@/lib/sabcrm/emails/src/constants/DefaultWorkspaceLogo';
import { capitalize } from '@/lib/sabcrm/emails/src/utils/capitalize';
import { createI18nInstance } from '@/lib/sabcrm/emails/src/utils/i18n.utils';
import { getImageAbsoluteURI } from '@/lib/sabcrm/shared/utils';

type APP_LOCALES = Record<string, string>;

type SendApprovedAccessDomainValidationProps = {
  link: string;
  domain: string;
  workspace: { name: string | undefined; logo: string | undefined };
  sender: {
    email: string;
    firstName: string;
    lastName: string;
  };
  serverUrl: string;
  locale: keyof APP_LOCALES;
};

export const SendApprovedAccessDomainValidation = ({
  link,
  domain,
  workspace,
  sender,
  serverUrl,
  locale,
}: SendApprovedAccessDomainValidationProps) => {
  const i18n = createI18nInstance(locale);
  const workspaceLogo = workspace.logo
    ? getImageAbsoluteURI({ imageUrl: workspace.logo, baseUrl: serverUrl })
    : null;

  const senderName = capitalize(sender.firstName);
  const senderEmail = sender.email;

  return (
    <BaseEmail width={333} locale={locale}>
      <Title value={i18n._('Validate domain')} />
      <MainText>
        <Trans
          id="{senderName} (<0>{senderEmail}</0>): Please validate this domain to allow users with <1>@{domain}</1> email addresses to join your workspace without requiring an invitation."
          values={{ senderName, senderEmail, domain }}
          components={{
            0: (
              <Link
                href={`mailto:${senderEmail}`}
                value={senderEmail}
                color={emailTheme.font.colors.blue}
              />
            ),
            1: <b />,
          }}
        />
        <br />
      </MainText>
      <HighlightedContainer>
        <Img
          src={workspaceLogo ?? DEFAULT_WORKSPACE_LOGO}
          width={40}
          height={40}
          alt={workspace.name ?? 'Workspace logo'}
        />
        {workspace.name ? <HighlightedText value={workspace.name} /> : <></>}
        <CallToAction href={link} value={i18n._('Validate domain')} />
      </HighlightedContainer>
      <br />
    </BaseEmail>
  );
};

SendApprovedAccessDomainValidation.PreviewProps = {
  link: 'https://app.sabnode.com/validate-domain',
  domain: 'example.com',
  workspace: {
    name: 'Acme Inc.',
    logo: 'https://fakeimg.pl/200x200/?text=ACME&font=lobster',
  },
  sender: {
    email: 'john.doe@example.com',
    firstName: 'John',
    lastName: 'Doe',
  },
  serverUrl: 'https://app.sabnode.com',
  locale: 'en',
};

export default SendApprovedAccessDomainValidation;
