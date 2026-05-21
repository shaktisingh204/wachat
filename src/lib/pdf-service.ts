/**
 * Server-side PDF generation via headless Chromium (Puppeteer).
 *
 * Why Puppeteer: pixel-perfect HTML/CSS rendering — closest parity with
 * the Worksuite DomPDF approach we are replacing — and supports inline
 * data-URL images plus the print-CSS we already emit in the templates.
 *
 * Single browser instance is cached at the module level. Launch is the
 * expensive bit (~400ms cold); reusing it keeps per-PDF cost under
 * ~150ms for a typical invoice.
 */

import 'server-only';
import puppeteer, { type Browser } from 'puppeteer';

let browserInstance: Browser | null = null;
let launchPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.connected) return browserInstance;
  if (launchPromise) return launchPromise;

  launchPromise = puppeteer
    .launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--font-render-hinting=none',
      ],
    })
    .then((b) => {
      browserInstance = b;
      b.on('disconnected', () => {
        browserInstance = null;
      });
      return b;
    })
    .finally(() => {
      launchPromise = null;
    });

  return launchPromise;
}

export type PdfFormat = 'A4' | 'Letter';

export type PdfOptions = {
  format?: PdfFormat;
  landscape?: boolean;
  margin?: { top?: string; bottom?: string; left?: string; right?: string };
};

export async function htmlToPdf(html: string, options?: PdfOptions): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // `domcontentloaded` is sufficient — templates inline every asset
    // (CSS, images as data URLs). `networkidle0` would just wait for a
    // timeout. Setting a short navigation timeout guards against any
    // accidental external URL slipping into a template.
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    await page.emulateMediaType('print');

    const pdf = await page.pdf({
      format: options?.format ?? 'A4',
      landscape: options?.landscape ?? false,
      printBackground: true,
      preferCSSPageSize: false,
      margin: {
        top: options?.margin?.top ?? '20mm',
        bottom: options?.margin?.bottom ?? '20mm',
        left: options?.margin?.left ?? '15mm',
        right: options?.margin?.right ?? '15mm',
      },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => {
      /* ignore close errors */
    });
  }
}

// Graceful shutdown — close the cached browser so we don't leak the
// Chromium process when the Next.js server stops.
let teardownRegistered = false;
function registerTeardown(): void {
  if (teardownRegistered) return;
  teardownRegistered = true;
  const close = async (): Promise<void> => {
    if (browserInstance) {
      try {
        await browserInstance.close();
      } catch {
        /* ignore */
      }
      browserInstance = null;
    }
  };
  process.once('SIGTERM', close);
  process.once('SIGINT', close);
}
registerTeardown();
