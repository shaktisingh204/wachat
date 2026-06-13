/**
 * Public CSAT survey — `/share/csat/[token]`.
 *
 * Lookup keyed on `sabcrm_case_csat.token` (a 32-char hex token minted by the
 * gated `issueCsatLinkTw` action). Unauthenticated: lives under the public
 * `/share/*` layout, never the logged-in `/sabcrm` surface. If the token is
 * invalid → 404; if the survey was already submitted → a static thanks panel;
 * otherwise the 1–5 star form (client) submits via the ungated-but-validated
 * `submitCsatPublic` action.
 */

import * as React from 'react';
import { notFound } from 'next/navigation';

import { Card, CardBody, CardHeader, CardTitle } from '@/components/sabcrm/20ui';
import { getCsatSurvey } from '@/lib/sabcrm/cases.server';
import { CsatSurveyForm } from './csat-form';

export const dynamic = 'force-dynamic';

type Params = Promise<{ token: string }>;

async function CsatSurveyContainer({ token }: { token: string }) {
  const survey = await getCsatSurvey(token);
  if (!survey) notFound();

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Card>
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--st-text)]">
            How did we do?
          </p>
          <CardTitle className="mt-1">{survey.caseSubject}</CardTitle>
          <p className="mt-3 text-sm text-[var(--st-text)]">
            Your case has been resolved. Please take a moment to rate your
            experience — your feedback helps us improve.
          </p>
        </CardHeader>
        <CardBody>
          <CsatSurveyForm
            token={survey.token}
            alreadySubmitted={survey.alreadySubmitted}
            existing={survey.existing}
          />
        </CardBody>
      </Card>
    </div>
  );
}

export default async function CsatSurveyPage({ params }: { params: Params }) {
  const { token } = await params;
  return (
    <React.Suspense fallback={<div>Loading survey…</div>}>
      <CsatSurveyContainer token={token} />
    </React.Suspense>
  );
}
