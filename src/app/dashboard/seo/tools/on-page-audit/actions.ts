'use server';

import puppeteer from 'puppeteer';

export async function runPuppeteerAudit(url: string) {
  let browser;
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) {
      return { error: 'Invalid URL protocol' };
    }

    browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 });
    
    const bodyText = await page.evaluate(() => document.body?.innerText || '');
    const wordCount = bodyText.trim() === '' ? 0 : bodyText.trim().split(/\s+/).length;
    
    const content = await page.content();
    const finalUrl = page.url();
    
    await browser.close();
    
    return { body: content, finalUrl, wordCount };
  } catch (e: any) {
    if (browser) await browser.close();
    return { error: e.message || 'Failed to fetch the URL' };
  }
}
