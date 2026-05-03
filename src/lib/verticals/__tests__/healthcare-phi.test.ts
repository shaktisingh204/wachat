/**
 * Healthcare / HIPAA PHI tests.
 *
 * Run via:
 *   npx tsx --test src/lib/verticals/__tests__/healthcare-phi.test.ts
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { redactPHI, runHook } from '../compliance-hooks';
import {
  installVertical,
  registerVertical,
  TraceTransport,
  unregisterVertical,
} from '../registry';
import { applyTemplate } from '../template-engine';
import { HEALTHCARE_VERTICAL } from '../verticals/healthcare';
import type { VerticalTemplate } from '../types';

// 1 ─────────────────────────────────────────────────────────────────────────
test('redactPHI replaces sensitive PHI keys with sentinels', () => {
  const input = {
    first_name: 'Asha',
    last_name: 'Verma',
    mrn: 'MRN-001',
    dob: '1985-04-12',
    diagnosis: 'E11.9',
    notes: 'Patient is well',
  };
  const out = redactPHI(input);
  assert.equal(out.first_name, 'Asha', 'non-PHI fields preserved');
  assert.equal(out.notes, 'Patient is well', 'non-PHI notes preserved');
  assert.equal(out.mrn, '[REDACTED:PHI]', 'MRN redacted');
  assert.equal(out.dob, '[REDACTED:PHI]', 'DOB redacted');
  assert.equal(out.diagnosis, '[REDACTED:PHI]', 'diagnosis redacted');
});

// 2 ─────────────────────────────────────────────────────────────────────────
test('hipaa.baa-gate blocks install without signed BAA', () => {
  const blocked = runHook('hipaa.baa-gate', { tenantId: 't1' });
  assert.equal(blocked.allowed, false);
  assert.match(blocked.reason ?? '', /BAA/);

  const ok = runHook('hipaa.baa-gate', { tenantId: 't1', tenantFlags: { baaSigned: true } });
  assert.equal(ok.allowed, true);
});

// 3 ─────────────────────────────────────────────────────────────────────────
test('installVertical(healthcare) is gated by BAA', async () => {
  registerVertical(HEALTHCARE_VERTICAL);
  await assert.rejects(
    () => installVertical('healthcare', 'tenant-no-baa'),
    /BAA/,
    'installs without BAA must throw',
  );

  const transport = new TraceTransport();
  const report = await installVertical('healthcare', 'tenant-with-baa', {
    tenantFlags: { baaSigned: true },
    transport,
  });
  assert.equal(report.verticalId, 'healthcare');
  assert.ok(report.entitiesProvisioned.includes('patient'));
  assert.ok(report.entitiesProvisioned.includes('appointment'));
  assert.ok(report.flowsInstalled >= 2, 'at least 2 baseline flows installed');
  assert.ok(transport.events.some((e) => e.kind === 'provisionEntity'));
  assert.ok(transport.events.some((e) => e.kind === 'installFlow'));
  unregisterVertical('healthcare');
});

// 4 ─────────────────────────────────────────────────────────────────────────
test('hipaa.minimum-necessary blocks agents from writing diagnosis', () => {
  const verdict = runHook('hipaa.minimum-necessary', {
    tenantId: 't1',
    entity: 'patient',
    actor: { id: 'u1', role: 'agent' },
    payload: { first_name: 'Asha', diagnosis: 'E11.9' },
  });
  assert.equal(verdict.allowed, false);
  assert.match(verdict.reason ?? '', /minimum-necessary/);
});

// 5 ─────────────────────────────────────────────────────────────────────────
test('hipaa.phi-redaction sanitises outbound message payload', () => {
  const verdict = runHook('hipaa.phi-redaction', {
    tenantId: 't1',
    payload: { first_name: 'Asha', mrn: 'MRN-001', clinic: 'Mercy' },
  });
  assert.equal(verdict.allowed, true);
  assert.ok(verdict.sanitisedPayload, 'sanitised payload returned');
  assert.equal(verdict.sanitisedPayload!.mrn, '[REDACTED:PHI]');
  assert.equal(verdict.sanitisedPayload!.first_name, 'Asha');
  assert.equal(verdict.sanitisedPayload!.clinic, 'Mercy');
});

// 6 ─────────────────────────────────────────────────────────────────────────
test('healthcare vertical declares HIPAA compliance hooks', () => {
  const ids = HEALTHCARE_VERTICAL.complianceHooks.map((h) => h.id);
  assert.ok(ids.includes('hipaa.baa-gate'), 'must include BAA gate');
  assert.ok(ids.includes('hipaa.phi-redaction'), 'must include PHI redaction');
  assert.ok(ids.includes('hipaa.minimum-necessary'), 'must include minimum-necessary');

  const sensitivePatientFields = HEALTHCARE_VERTICAL.dataModel.entities
    .find((e) => e.name === 'patient')!
    .fields.filter((f) => f.sensitive)
    .map((f) => f.key);
  assert.ok(sensitivePatientFields.includes('mrn'));
  assert.ok(sensitivePatientFields.includes('diagnosis'));
});

// 7 ─────────────────────────────────────────────────────────────────────────
test('applyTemplate merges a flow pack into healthcare without duplication', () => {
  const tpl: VerticalTemplate = {
    id: 'healthcare.telehealth-pack',
    name: 'Telehealth Pack',
    vertical: 'healthcare',
    payload: {
      baselineFlows: [
        {
          id: 'healthcare.telehealth-link',
          name: 'Telehealth Link Send',
          description: 'Send telehealth link 10 min before appointment.',
          trigger: 'appointment.scheduled',
          steps: ['wait_until:T-10m', 'send_sms:telehealth-link'],
        },
      ],
    },
  };
  const merged = applyTemplate(tpl, HEALTHCARE_VERTICAL);
  assert.equal(merged.id, 'healthcare');
  assert.equal(
    merged.baselineFlows.length,
    HEALTHCARE_VERTICAL.baselineFlows.length + 1,
    'merged flows include the telehealth flow',
  );
  assert.ok(merged.baselineFlows.some((f) => f.id === 'healthcare.telehealth-link'));
  // Idempotency: re-applying replaces by id, never duplicates.
  const merged2 = applyTemplate(tpl, merged);
  assert.equal(merged2.baselineFlows.length, merged.baselineFlows.length);
});
