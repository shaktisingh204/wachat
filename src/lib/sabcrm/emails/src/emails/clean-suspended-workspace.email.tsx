// Ported from twenty-emails/src/emails/clean-suspended-workspace.email.tsx
// Fixed imports to relative sibling paths; removed twenty-shared dep

import { Trans } from '@lingui/react';

import { APP_LOCALES } from '@/lib/sabcrm/emails/lingui.config';
import { BaseEmail } from '../components/BaseEmail';
import { CallToAction } from '../components/CallToAction';
import { MainText } from '../components/MainText';
import { Title } from '../components/Title';
import { createI18nInstance } from '../utils/i18n.utils';

type CleanSuspendedWorkspaceEmailProps = {
  daysSinceInactive: number;
  userName: string;
  workspaceDisplayName: string | undefined;
  locale: keyof typeof APP_LOCALES;
};

export const CleanSuspendedWorkspaceEmail = ({
  daysSinceInactive,
  userName,
  workspaceDisplayName,
  locale,
}: CleanSuspendedWorkspaceEmailProps) => {
  const i18n = createI18nInstance(locale);

  return (
    <BaseEmail width={333} locale={locale}>
      <Title value={i18n._('Deleted Workspace')} />
      <MainText>
        {userName?.length > 1 ? (
          <Trans id="Dear {userName}," values={{ userName }} />
        ) : (
          <Trans id="Hello," />
        )}
        <br />
        <br />
        <Trans
          id="Your workspace <0>{workspaceDisplayName}</0> has been deleted as your subscription expired {daysSinceInactive} days ago."
          values={{ workspaceDisplayName, daysSinceInactive }}
          components={{ 0: <b /> }}
        />
        <br />
        <br />
        <Trans id="All data in this workspace has been permanently deleted." />
        <br />
        <br />
        <Trans id="If you wish to use SabCRM again, you can create a new workspace." />
      </MainText>
      <br />
      <CallToAction
        href="https://app.sabnode.com/"
        value={i18n._('Create a new workspace')}
      />
      <br />
      <br />
    </BaseEmail>
  );
};

CleanSuspendedWorkspaceEmail.PreviewProps = {
  daysSinceInactive: 1,
  userName: 'John Doe',
  workspaceDisplayName: 'My Workspace',
  locale: 'en',
};

export default CleanSuspendedWorkspaceEmail;
