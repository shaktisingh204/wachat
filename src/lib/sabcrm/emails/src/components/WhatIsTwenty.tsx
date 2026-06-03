// Ported from twenty-emails/src/components/WhatIsTwenty.tsx
// Fixed imports to relative sibling paths

import { type I18n } from '@lingui/core';

import { MainText } from './MainText';
import { SubTitle } from './SubTitle';

type WhatIsTwentyProps = {
  i18n: I18n;
};

export const WhatIsTwenty = ({ i18n }: WhatIsTwentyProps) => {
  return (
    <>
      <SubTitle value={i18n._('What is SabCRM?')} />
      <MainText>
        {i18n._(
          "It's a CRM, a software to help businesses manage their customer data and relationships efficiently.",
        )}
      </MainText>
    </>
  );
};
