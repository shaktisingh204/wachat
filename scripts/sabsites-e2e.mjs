#!/usr/bin/env node
/**
 * SabSites embed smoke test.
 *
 * Verifies the full merged flow against a running `next dev -p 3002`:
 *  1. unified auth — a SabNode session JWT cookie alone opens the SabSites
 *     dashboard (no separate login)
 *  2. project creation through the real UI (trpc + CSRF)
 *  3. the project builder opens on its p-<projectId> subdomain via the
 *     internal ws-OAuth handshake and the canvas renders
 *
 * Usage: node scripts/sabsites-e2e.mjs
 * Env: SABSITES_E2E_BASE (default http://localhost:3002),
 *      JWT_SECRET (default read from .env)
 */
import { chromium } from 'playwright';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';

const base = process.env.SABSITES_E2E_BASE ?? 'http://localhost:3002';

const readEnvValue = (name) => {
    try {
        const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
        const lines = env.split('\n').filter((l) => l.startsWith(`${name}=`));
        return lines.at(-1)?.slice(name.length + 1);
    } catch {
        return undefined;
    }
};

const jwtSecret = process.env.JWT_SECRET ?? readEnvValue('JWT_SECRET');
if (!jwtSecret) throw new Error('JWT_SECRET not found');

const b64 = (value) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const head = b64({ alg: 'HS256', typ: 'JWT' });
const payload = b64({
    jti: 'sabsites-e2e',
    userId: 'sabsites-e2e',
    email: 'sabsites-e2e@sabnode.com',
    name: 'SabSites E2E',
    iat: now,
    exp: now + 3600,
});
const signature = createHmac('sha256', jwtSecret)
    .update(`${head}.${payload}`)
    .digest('base64url');
const sessionJwt = `${head}.${payload}.${signature}`;

const fail = (message) => {
    console.error(`FAIL: ${message}`);
    process.exit(1);
};

const browser = await chromium.launch();
try {
    const context = await browser.newContext({ baseURL: base });
    const { hostname } = new URL(base);
    await context.addCookies([
        {
            name: 'session',
            value: sessionJwt,
            domain: hostname,
            path: '/',
            httpOnly: true,
        },
    ]);
    const page = await context.newPage();

    // Collect CSP violations and failed /sites asset requests across the run.
    const cspViolations = [];
    const failedRequests = [];
    page.on('console', (msg) => {
        const t = msg.text();
        if (/Content Security Policy|violates the following/i.test(t)) {
            cspViolations.push(t);
        }
    });
    const watchFailures = (target) => {
        target.on('response', (r) => {
            const u = r.url();
            if (
                u.includes('/sites/cgi/') ||
                u.includes('/sites/canvas') ||
                u.includes('/sites/rest/')
            ) {
                if (r.status() >= 400) failedRequests.push(`${r.status()} ${u}`);
            }
        });
    };
    watchFailures(page);
    page.on('frameattached', () => {}); // ensure frame events fire
    context.on('page', watchFailures);

    // 1. unified auth straight into the dashboard
    await page.goto('/sites/dashboard', { waitUntil: 'networkidle' });
    if (page.url().includes('/login')) fail('redirected to login — unified auth broken');
    await page.getByText('My workspace').first().waitFor({ timeout: 15000 });
    console.log('PASS: unified auth -> dashboard');

    // 2. create a project through the UI (welcome state or projects view)
    const createButton = page
        .getByRole('button', { name: /create a blank project|new project/i })
        .first();
    await createButton.click();
    const nameField = page.getByRole('textbox').first();
    if (await nameField.isVisible({ timeout: 5000 }).catch(() => false)) {
        await nameField.fill(`E2E ${Date.now()}`);
        await page.keyboard.press('Enter');
    }

    // 3. builder opens on the p-<projectId> subdomain
    await page.waitForURL(/p-[0-9a-f-]+\./, { timeout: 30000 });
    console.log(`PASS: builder URL ${new URL(page.url()).host}`);
    await page.waitForLoadState('networkidle');

    // 4. the canvas iframe must actually load (not be CSP-blocked) and contain
    //    a real builder document, not a 404/error body.
    const canvasFrame = page
        .frames()
        .find((f) => f.url().includes('/sites/canvas'));
    if (!canvasFrame) fail('canvas iframe (/sites/canvas) never attached — CSP block?');
    await canvasFrame.locator('body').waitFor({ timeout: 30000 });
    const canvasText = await canvasFrame.locator('body').innerText().catch(() => '');
    if (/not found|404|error/i.test(canvasText) && canvasText.length < 200) {
        fail(`canvas loaded an error page: ${canvasText.slice(0, 120)}`);
    }
    console.log('PASS: builder canvas rendered (real document)');

    // 5. no CSP violations, no failed /sites asset/canvas requests
    await page.waitForTimeout(1500);
    if (cspViolations.length) fail(`CSP violations:\n  ${cspViolations.join('\n  ')}`);
    if (failedRequests.length) fail(`failed /sites requests:\n  ${failedRequests.join('\n  ')}`);
    console.log('PASS: no CSP violations, no failed /sites requests');
    console.log('ALL PASS');
} finally {
    await browser.close();
}
