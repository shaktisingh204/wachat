/**
 * SabCRM People — New employee (`/sabcrm/people/employees/new`).
 *
 * Server entry for the full-page grouped onboarding form (the
 * create-DTO field set is too large for a dialog — spec WI-24). All
 * pickers + the submit run through the gated employees actions.
 */

import * as React from 'react';

import { EmployeeNewClient } from './employee-new-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'New employee — SabCRM People',
};

export default function SabcrmPeopleEmployeeNewPage(): React.JSX.Element {
  return <EmployeeNewClient />;
}
