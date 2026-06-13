#!/usr/bin/env node
/**
 * SabCRM People suite — payroll-run fixture verification (WI-37).
 *
 * Cloned from scripts/sabpay-e2e.mjs per docs/sabcrm/rnd/people-suite.md §6.
 * Drives the PROJECT-scoped mounts (`/v1/sabcrm/people/*`) on the local Rust
 * engine and asserts EXACT payroll math:
 *
 *   1. Seed   — payroll settings, department, rich salary structure
 *               "E2E Eng 2026" (BASIC percent_ctc 40, HRA percent_basic 50,
 *               SPECIAL formula, PF formula `min(basic, 15000) * 0.12`
 *               maxCap 1800 statutory, PT fixed 200), two employees
 *               (annual ctc 1,200,000 and 600,000).
 *   2. Run    — create + compute; per-employee rows and totals must match
 *               to the rupee. PF must be EXACTLY 1800 and — guard against
 *               the silent-zero formula engine failure (risk R2) — the
 *               script FAILS LOUDLY if pf <= 0.
 *   3. Lifecycle — approve / disburse (re-disburse 409) /
 *               generate-payslips (2 rich payslips, netPay match,
 *               netPayInWords non-empty, masked bank string) / compute on
 *               a disbursed run 409.
 *   4. Scope isolation — a second projectId sees ZERO employees/runs;
 *               requests without projectId are rejected 4xx.
 *   5. Legacy-shape resilience — insert one FLAT CrmSalaryStructure doc
 *               (direct Mongo write), point a third employee at it, compute
 *               a fresh run: it must succeed, skip that employee, and keep
 *               the totals of the other two (graceful-skip, WI-5 / R1).
 *               Skipped (loudly) when Mongo is unreachable from this host.
 *
 * Usage: node scripts/sabcrm-people-e2e.mjs
 *   ENGINE=http://localhost:8080
 *   RUST_JWT_SECRET / MONGODB_URI / MONGODB_DB — read from rust/.env if unset.
 */
import { SignJWT } from 'jose';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const ENGINE = process.env.ENGINE || 'http://localhost:8080';
const BASE = `${ENGINE}/v1/sabcrm/people`;

// ---------------------------------------------------------------- env
function rustEnv(key) {
  if (process.env[key]) return process.env[key];
  try {
    const txt = readFileSync(new URL('../rust/.env', import.meta.url), 'utf8');
    const m = txt.match(new RegExp(`^${key}=(.*)$`, 'm'));
    if (m) return m[1].trim();
  } catch {}
  return undefined;
}
function secretFromEnv() {
  const s = rustEnv('RUST_JWT_SECRET');
  if (!s) throw new Error('RUST_JWT_SECRET not found in env or rust/.env');
  return s;
}

// ---------------------------------------------------------------- ids / jwt
const hex24 = () => randomBytes(12).toString('hex');
const SUB = 'aaaaaaaaaaaaaaaaaaaaaaaa'; // 24-hex test user (audit stamps only)
const PROJECT_A = hex24(); // fresh per run → deterministic roster/totals
const PROJECT_B = hex24(); // isolation probe — never written to

async function mintJwt() {
  const secret = new TextEncoder().encode(secretFromEnv());
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ tid: SUB, roles: ['owner'] })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(SUB)
    .setIssuer('sabnode-bff')
    .setIssuedAt(now)
    .setExpirationTime(now + 900)
    .sign(secret);
}

// ---------------------------------------------------------------- harness
let pass = 0,
  fail = 0,
  skip = 0;
const results = [];
function check(name, ok, detail = '') {
  if (ok) {
    pass++;
    results.push(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    fail++;
    results.push(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
  return ok;
}
function skipped(name, why) {
  skip++;
  results.push(`  ⚠ SKIP ${name} — ${why}`);
}

let TOKEN;
async function api(method, path, body) {
  const headers = { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` };
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

// Gen-1 entities serialize ObjectId/DateTime as Mongo extended JSON.
const oid = (v) => (v && typeof v === 'object' && '$oid' in v ? v.$oid : v);
const approx = (a, b, eps = 0.01) => typeof a === 'number' && Math.abs(a - b) < eps;
const money = (n) => (typeof n === 'number' ? n.toLocaleString('en-IN') : String(n));

// ---------------------------------------------------------------- fixture
// Annual CTCs (employee.employment.ctc is ANNUAL; compute divides by 12).
const CTC_A = 1_200_000; // monthly 100,000
const CTC_B = 600_000; //   monthly  50,000
// Expected per-employee rows (people-suite.md §6.2).
const EXPECT = {
  A: { basic: 40_000, hra: 20_000, special: 40_000, pf: 1_800, pt: 200, gross: 100_000, net: 98_000, ctc: 100_000 },
  B: { basic: 20_000, hra: 10_000, special: 20_000, pf: 1_800, pt: 200, gross: 50_000, net: 48_000, ctc: 50_000 },
  totals: { gross: 150_000, net: 146_000, employeeCount: 2 },
};

const STRUCTURE_COMPONENTS = [
  { name: 'Basic', code: 'BASIC', type: 'earning', calc: { kind: 'percent_ctc', pct: 40 }, taxable: true, frequency: 'monthly' },
  { name: 'House Rent Allowance', code: 'HRA', type: 'earning', calc: { kind: 'percent_basic', pct: 50 }, taxable: true, frequency: 'monthly' },
  { name: 'Special Allowance', code: 'SPECIAL', type: 'earning', calc: { kind: 'formula', expr: 'monthlyCtc - basic - basic * 0.5' }, taxable: true, frequency: 'monthly' },
  { name: 'Provident Fund', code: 'PF', type: 'deduction', calc: { kind: 'formula', expr: 'min(basic, 15000) * 0.12' }, statutory: true, maxCap: 1800, frequency: 'monthly' },
  { name: 'Professional Tax', code: 'PT', type: 'deduction', calc: { kind: 'fixed', amount: 200 }, statutory: true, frequency: 'monthly' },
];

function monthRange() {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));
  return { from: from.toISOString(), to: to.toISOString() };
}

function rowLines(row) {
  const e = Object.fromEntries((row.earnings ?? []).map((l) => [l.code, l.amount]));
  const d = Object.fromEntries((row.deductions ?? []).map((l) => [l.code, l.amount]));
  return { ...e, ...d };
}

function assertRow(label, row, exp) {
  const lines = rowLines(row);
  // R2 guard FIRST: a silent-zero min() must fail loudly.
  check(`${label}: PF > 0 (formula engine must support min())`, lines.PF > 0, `pf=${lines.PF}`);
  check(`${label}: BASIC = ${money(exp.basic)}`, approx(lines.BASIC, exp.basic), `got ${lines.BASIC}`);
  check(`${label}: HRA = ${money(exp.hra)}`, approx(lines.HRA, exp.hra), `got ${lines.HRA}`);
  check(`${label}: SPECIAL = ${money(exp.special)}`, approx(lines.SPECIAL, exp.special), `got ${lines.SPECIAL}`);
  check(`${label}: PF = ${money(exp.pf)} (min-cap no-op)`, approx(lines.PF, exp.pf), `got ${lines.PF}`);
  check(`${label}: PT = ${money(exp.pt)}`, approx(lines.PT, exp.pt), `got ${lines.PT}`);
  check(`${label}: gross = ${money(exp.gross)}`, approx(row.gross, exp.gross), `got ${row.gross}`);
  check(`${label}: net = ${money(exp.net)}`, approx(row.net, exp.net), `got ${row.net}`);
  check(`${label}: ctc = ${money(exp.ctc)}`, approx(row.ctc, exp.ctc), `got ${row.ctc}`);
}

async function createEmployee({ first, last, email, ctc, structureId, departmentId, designationId }) {
  const r = await api('POST', '/employees', {
    projectId: PROJECT_A,
    firstName: first,
    lastName: last,
    displayName: `${first} ${last}`,
    dob: '1992-03-14T00:00:00Z',
    joiningDate: '2024-04-01T00:00:00Z',
    departmentId,
    designationId,
    workEmail: email,
    salaryStructureId: structureId,
    employmentType: 'full_time',
    ctc,
    status: 'active',
  });
  const id = oid(r.json?._id);
  check(`POST /employees (${first}, ctc ${money(ctc)})`, r.status === 200 && !!id, `status ${r.status} id=${id}`);
  return id;
}

// ---------------------------------------------------------------- main
async function main() {
  console.log(`\n=== SabCRM People E2E — engine ${ENGINE} — projectId ${PROJECT_A} ===\n`);

  // 0. engine reachable?
  try {
    const r = await fetch(`${ENGINE}/health`);
    if (!check('GET /health 200', r.status === 200, `status ${r.status}`)) throw new Error('unhealthy');
  } catch (e) {
    console.error(`Engine not reachable at ${ENGINE} — start it first (SabPay local-stack runbook). ${e.message ?? e}`);
    process.exit(3);
  }
  TOKEN = await mintJwt();

  // ---- 1. SEED ----------------------------------------------------
  // 1a. payroll settings singleton (PUT upsert + GET round-trip).
  {
    const put = await api('PUT', '/payroll-settings', {
      projectId: PROJECT_A,
      companyName: 'E2E People Co',
      payCycle: 'monthly',
      pfRate: 12,
      esiRate: 0.75,
      defaultCurrency: 'INR',
    });
    check('PUT /payroll-settings (upsert, payCycle monthly)', put.status === 200, `status ${put.status}`);
    const got = await api('GET', `/payroll-settings?projectId=${PROJECT_A}`);
    check(
      'GET /payroll-settings singleton round-trip',
      got.status === 200 && (got.json?.companyName === 'E2E People Co' || got.json?.payCycle === 'monthly'),
      `status ${got.status} companyName=${got.json?.companyName}`,
    );
  }

  // 1b. department (user-mount /v1/crm/departments — pickers' source).
  //     Employee create does NOT FK-validate departmentId, so a failure
  //     here degrades to a minted ObjectId rather than failing the run.
  let departmentId = hex24();
  const designationId = hex24(); // label resolution is deferred (crm-employees)
  {
    try {
      const r = await fetch(`${ENGINE}/v1/crm/departments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify({ name: 'E2E Engineering', projectId: PROJECT_A }),
      });
      const j = await r.json().catch(() => null);
      const id = oid(j?._id) ?? j?.id;
      if (r.ok && id) {
        departmentId = id;
        check('POST /v1/crm/departments (seed)', true, id);
      } else {
        skipped('POST /v1/crm/departments', `status ${r.status} — using minted departmentId`);
      }
    } catch (e) {
      skipped('POST /v1/crm/departments', `${e.message} — using minted departmentId`);
    }
  }

  // 1c. RICH salary structure (project mount CRUDs hrm_payroll_types shape).
  let structureId;
  {
    const r = await api('POST', '/salary-structures', {
      projectId: PROJECT_A,
      name: 'E2E Eng 2026',
      effectiveDate: '2026-01-01T00:00:00Z',
      components: STRUCTURE_COMPONENTS,
      applicableTo: [],
      active: true,
    });
    structureId = r.json?.id ?? oid(r.json?.entity?._id);
    check('POST /salary-structures (rich, 5 components)', r.status === 200 && !!structureId, `status ${r.status} id=${structureId}`);
    if (!structureId) throw new Error('cannot continue without a salary structure');
  }

  // 1d. two active employees pointing at the structure.
  const empA = await createEmployee({ first: 'Asha', last: 'Verma', email: 'asha.e2e@example.com', ctc: CTC_A, structureId, departmentId, designationId });
  const empB = await createEmployee({ first: 'Bilal', last: 'Khan', email: 'bilal.e2e@example.com', ctc: CTC_B, structureId, departmentId, designationId });
  if (!empA || !empB) throw new Error('cannot continue without both employees');

  // ---- 2. RUN + EXACT MATH ----------------------------------------
  const { from, to } = monthRange();
  let runId;
  {
    const r = await api('POST', '/payroll-runs', {
      projectId: PROJECT_A,
      periodFrom: from,
      periodTo: to,
      payDate: to,
      bankFileFormat: 'neft',
    });
    runId = oid(r.json?._id);
    check('POST /payroll-runs (current month, neft)', r.status === 200 && !!runId, `status ${r.status} id=${runId}`);
    if (!runId) throw new Error('cannot continue without a run');
  }

  let run;
  {
    const r = await api('POST', `/payroll-runs/${runId}/compute?projectId=${PROJECT_A}`);
    run = r.json;
    check('POST /{runId}/compute 200', r.status === 200, `status ${r.status}`);
    check('compute settles status back to draft', run?.status === 'draft', `status=${run?.status}`);
    const rows = run?.employees ?? [];
    check('compute produced 2 employee rows', rows.length === 2, `len=${rows.length}`);
    const byEmp = new Map(rows.map((row) => [oid(row.employeeId), row]));
    const rowA = byEmp.get(empA);
    const rowB = byEmp.get(empB);
    check('row for employee A present', !!rowA);
    check('row for employee B present', !!rowB);
    if (rowA) assertRow('emp A (monthlyCtc 100,000)', rowA, EXPECT.A);
    if (rowB) assertRow('emp B (monthlyCtc 50,000)', rowB, EXPECT.B);
    const t = run?.totals ?? {};
    check('totals.gross = 150,000', approx(t.gross, EXPECT.totals.gross), `got ${t.gross}`);
    check('totals.net = 146,000', approx(t.net, EXPECT.totals.net), `got ${t.net}`);
    check('totals.employeeCount = 2', t.employeeCount === 2, `got ${t.employeeCount}`);
  }

  // second compute — legal again from draft/processing, same numbers.
  {
    const r = await api('POST', `/payroll-runs/${runId}/compute?projectId=${PROJECT_A}`);
    check('second compute idempotent (200, same totals)', r.status === 200 && approx(r.json?.totals?.net, EXPECT.totals.net), `status ${r.status} net=${r.json?.totals?.net}`);
  }

  // ---- 3. LIFECYCLE -------------------------------------------------
  {
    const r = await api('POST', `/payroll-runs/${runId}/approve?projectId=${PROJECT_A}`, {
      projectId: PROJECT_A,
      approverId: SUB,
      comment: 'e2e approve',
    });
    const approvals = r.json?.approvals ?? [];
    check('approve → status approved', r.status === 200 && r.json?.status === 'approved', `status=${r.json?.status}`);
    check('approvals[0] stamped', approvals.length >= 1 && !!oid(approvals[0]?.approverId), `n=${approvals.length}`);
  }
  {
    const r = await api('POST', `/payroll-runs/${runId}/disburse?projectId=${PROJECT_A}`);
    check('disburse → status disbursed', r.status === 200 && r.json?.status === 'disbursed', `status=${r.json?.status}`);
    check('disburse minted bankFileId', !!oid(r.json?.bankFileId));
    const again = await api('POST', `/payroll-runs/${runId}/disburse?projectId=${PROJECT_A}`);
    check('re-disburse → 409', again.status === 409, `status ${again.status}`);
  }
  {
    const r = await api('POST', `/payroll-runs/${runId}/generate-payslips?projectId=${PROJECT_A}`);
    check('generate-payslips: generated=2 skipped=0', r.status === 200 && r.json?.generated === 2 && r.json?.skipped === 0, `g=${r.json?.generated} s=${r.json?.skipped}`);
    check('generate-payslips: 2 payslipIds', (r.json?.payslipIds ?? []).length === 2);
    // idempotency: a second generate upserts, never duplicates.
    const again = await api('POST', `/payroll-runs/${runId}/generate-payslips?projectId=${PROJECT_A}`);
    check('generate-payslips idempotent (still 2 ids)', again.status === 200 && (again.json?.payslipIds ?? []).length === 2, `len=${(again.json?.payslipIds ?? []).length}`);

    const list = await api('GET', `/payslips?projectId=${PROJECT_A}&runId=${runId}&limit=10`);
    const slips = (list.json?.items ?? []).filter((p) => oid(p.runId) === runId);
    check('GET /payslips?runId → 2 rich payslips', slips.length === 2, `len=${slips.length}`);
    const nets = slips.map((p) => p.netPay).sort((a, b) => a - b);
    check('payslip netPay values match run rows (48,000 / 98,000)', approx(nets[0], EXPECT.B.net) && approx(nets[1], EXPECT.A.net), `got [${nets.join(', ')}]`);
    for (const p of slips) {
      check('payslip netPayInWords non-empty', typeof p.netPayInWords === 'string' && p.netPayInWords.length > 0, p.netPayInWords?.slice(0, 40));
      check('payslip bank account is the masked snapshot string', typeof p.bankInfoSnapshot?.accountNoMasked === 'string' && !/^\d{9,}$/.test(p.bankInfoSnapshot.accountNoMasked), `masked=${p.bankInfoSnapshot?.accountNoMasked}`);
    }
  }
  {
    const r = await api('POST', `/payroll-runs/${runId}/compute?projectId=${PROJECT_A}`);
    check('compute on a disbursed run → 409', r.status === 409, `status ${r.status}`);
  }

  // ---- 4. SCOPE ISOLATION -------------------------------------------
  {
    const emps = await api('GET', `/employees?projectId=${PROJECT_B}`);
    const empArr = Array.isArray(emps.json) ? emps.json : emps.json?.items;
    check('project B sees ZERO employees', emps.status === 200 && (empArr ?? []).length === 0, `len=${(empArr ?? []).length}`);
    const runs = await api('GET', `/payroll-runs?projectId=${PROJECT_B}`);
    const runArr = Array.isArray(runs.json) ? runs.json : runs.json?.items;
    check('project B sees ZERO payroll runs', runs.status === 200 && (runArr ?? []).length === 0, `len=${(runArr ?? []).length}`);
    const noScope = await api('GET', '/employees');
    check('GET /employees without projectId → 4xx', noScope.status >= 400 && noScope.status < 500, `status ${noScope.status}`);
    const noScopeRun = await api('POST', `/payroll-runs/${runId}/compute`);
    check('compute without projectId → 4xx', noScopeRun.status >= 400 && noScopeRun.status < 500, `status ${noScopeRun.status}`);
  }

  // ---- 5. LEGACY-SHAPE RESILIENCE (graceful skip, WI-5/R1) -----------
  await (async () => {
    const uri = rustEnv('MONGODB_URI');
    const dbName = rustEnv('MONGODB_DB');
    if (!uri || !dbName) {
      skipped('legacy flat-structure graceful skip', 'MONGODB_URI / MONGODB_DB unavailable');
      return;
    }
    let mongoMod;
    try {
      mongoMod = await import('mongodb');
    } catch {
      skipped('legacy flat-structure graceful skip', 'mongodb driver not installed');
      return;
    }
    const { MongoClient, ObjectId } = mongoMod;
    let client;
    try {
      client = new MongoClient(uri, { serverSelectionTimeoutMS: 4000 });
      await client.connect();
      const coll = client.db(dbName).collection('crm_salary_structures');
      // FLAT CrmSalaryStructure shape — fails rich BSON decode in compute.
      const flatId = new ObjectId();
      await coll.insertOne({
        _id: flatId,
        userId: new ObjectId(SUB),
        projectId: new ObjectId(PROJECT_A),
        employeeId: new ObjectId(hex24()),
        basic: 30000,
        hra: 12000,
        da: 0,
        otherAllowances: 0,
        pfEmployer: 0,
        pfEmployee: 0,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      check('inserted FLAT CrmSalaryStructure doc (direct Mongo)', true, flatId.toHexString());

      const empC = await createEmployee({ first: 'Chitra', last: 'Rao', email: 'chitra.e2e@example.com', ctc: 900_000, structureId: flatId.toHexString(), departmentId, designationId });
      const r2 = await api('POST', '/payroll-runs', { projectId: PROJECT_A, periodFrom: from, periodTo: to, bankFileFormat: 'neft' });
      const run2Id = oid(r2.json?._id);
      check('POST /payroll-runs (run 2 for resilience pass)', r2.status === 200 && !!run2Id);
      const c = await api('POST', `/payroll-runs/${run2Id}/compute?projectId=${PROJECT_A}`);
      check('compute with mixed-shape structures → 200 (no 500)', c.status === 200, `status ${c.status}`);
      const t = c.json?.totals ?? {};
      const rows = c.json?.employees ?? [];
      check('flat-structure employee skipped (employeeCount stays 2)', t.employeeCount === 2, `got ${t.employeeCount}`);
      check('totals preserved for the other two (150,000 / 146,000)', approx(t.gross, EXPECT.totals.gross) && approx(t.net, EXPECT.totals.net), `gross=${t.gross} net=${t.net}`);
      check('skipped employee has no row', !rows.some((row) => oid(row.employeeId) === empC));
    } catch (e) {
      skipped('legacy flat-structure graceful skip', `mongo unreachable: ${e.message}`);
    } finally {
      await client?.close().catch(() => {});
    }
  })();

  // ---------------------------------------------------------------- summary
  console.log(results.join('\n'));
  console.log(`\n=== ${pass} passed, ${fail} failed, ${skip} skipped ===\n`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error('E2E crashed:', e);
  console.log(results.join('\n'));
  process.exit(2);
});
