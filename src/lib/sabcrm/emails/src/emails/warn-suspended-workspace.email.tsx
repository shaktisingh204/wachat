import { Trans } from '@lingui/react';
import { BaseEmail } from '@/lib/sabcrm/emails/src/components/BaseEmail';
import { CallToAction } from '@/lib/sabcrm/emails/src/components/CallToAction';
import { MainText } from '@/lib/sabcrm/emails/src/components/MainText';
import { Title } from '@/lib/sabcrm/emails/src/components/Title';
import { createI18nInstance } from '@/lib/sabcrm/emails/src/utils/i18n.utils';

type APP_LOCALES = Record<string, string>;

type WarnSuspendedWorkspaceEmailProps = {
  daysSinceInactive: number;
  inactiveDaysBeforeDelete: number;
  userName: string;
  workspaceDisplayName: string | undefined;
  locale: keyof APP_LOCALES;
};

export const WarnSuspendedWorkspaceEmail = ({
  daysSinceInactive,
  inactiveDaysBeforeDelete,
  userName,
  workspaceDisplayName,
  locale,
}: WarnSuspendedWorkspaceEmailProps) => {
  const i18n = createI18nInstance(locale);
  const daysLeft = inactiveDaysBeforeDelete - daysSinceInactive;
  const dayOrDays = daysLeft > 1 ? 'days' : 'day';
  const remainingDays = daysLeft > 0 ? daysLeft : 0;

  return (
    <BaseEmail width={333} locale={locale}>
      <Title value={i18n._('Suspended Workspace')} />
      <MainText>
        {userName?.length > 1 ? (
          <Trans id="Dear {userName}," values={{ userName }} />
        ) : (
          <Trans id="Hello," />
        )}
        <br />
        <br />
        <Trans
          id="It appears that your workspace <0>{workspaceDisplayName}</0> has been suspended for {daysSinceInactive} days."
          values={{ workspaceDisplayName, daysSinceInactive }}
          components={{ 0: <b /> }}
        />
        <br />
        <br />
        <Trans
          id="The workspace will be deactivated in {remainingDays} {dayOrDays}, and all its data will be deleted."
          values={{ remainingDays, dayOrDays }}
        />
        <br />
        <br />
        <Trans
          id="If you wish to continue using SabCRM, please update your subscription within the next {remainingDays} {dayOrDays}."
          values={{ remainingDays, dayOrDays }}
        />
      </MainText>
      <br />
      <CallToAction
        href="https://app.sabnode.com/settings/billing"
        value={i18n._('Update your subscription')}
      />
      <br />
      <br />
    </BaseEmail>
  );
};

WarnSuspendedWorkspaceEmail.PreviewProps = {
  daysSinceInactive: 10,
  inactiveDaysBeforeDelete: 14,
  userName: 'John Doe',
  workspaceDisplayName: 'Acme Inc.',
  locale: 'en',
};

export default WarnSuspendedWorkspaceEmail;
