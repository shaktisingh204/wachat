import { type Browser, type Page } from 'puppeteer';
// Note: We use a dynamic import for puppeteer in the function to avoid build errors 
// if the dependency is not installed yet during Next.js build time, 
// though for the worker (tsx) it should be fine if installed.
import { SeoPageAudit, SeoPageIssue } from './definitions';

export class SeoCrawler {
    private browser: Browser | null = null;

    async init() {
        // Dynamic import to be safe
        const puppeteer = (await import('puppeteer')).default;
        this.browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--ignore-certificate-errors',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu'
            ],
            ignoreHTTPSErrors: true
        });
    }

    async close() {
        if (this.browser) await this.browser.close();
    }

    async scanPage(url: string): Promise<SeoPageAudit> {
        if (!this.browser) await this.init();
        if (!this.browser) throw new Error("Browser not initialized");

        const page = await this.browser.newPage();
        const issues: SeoPageIssue[] = [];
        let status = 0;
        let loadTime = 0;

        try {
            await page.setUserAgent('Mozilla/5.0 (compatible; WaChatSEO/1.0)');

            const startTime = Date.now();
            const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            loadTime = Date.now() - startTime;

            status = response?.status() || 0;

            if (status >= 400) {
                issues.push({
                    code: 'broken_link',
                    message: `Page returned status code ${status}`,
                    severity: 'critical'
                });
                return { url, status, issues, crawledAt: new Date() };
            }

            // Extract Data
            const data = await page.evaluate(() => {
                const title = document.title;
                const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content');
                const h1 = document.querySelector('h1')?.innerText;
                const wordCount = document.body.innerText.split(/\s+/).length;
                return { title, metaDesc, h1, wordCount };
            });

            // Checks
            if (!data.title) {
                issues.push({ code: 'missing_title', message: 'Page title is missing', severity: 'critical' });
            } else if (data.title.length > 60) {
                issues.push({ code: 'title_too_long', message: `Title is too long (${data.title.length} chars)`, severity: 'warning' });
            }

            if (!data.metaDesc) {
                issues.push({ code: 'missing_description', message: 'Meta description is missing', severity: 'critical' });
            }

            if (!data.h1) {
                issues.push({ code: 'missing_h1', message: 'H1 tag is missing', severity: 'warning' });
            }

            // Word Count
            if (data.wordCount < 300) {
                issues.push({ code: 'thin_content', message: `Content is too short (${data.wordCount} words)`, severity: 'warning' });
            }

            // Load Time
            if (loadTime > 3000) {
                issues.push({ code: 'slow_load', message: `Page load time is slow (${loadTime}ms)`, severity: 'warning' });
            }

            return {
                url,
                status,
                title: data.title,
                metaDescription: data.metaDesc || undefined,
                h1: data.h1 || undefined,
                wordCount: data.wordCount,
                loadTime,
                issues,
                crawledAt: new Date()
            };

        } catch (error: any) {
            return {
                url,
                status: 0,
                issues: [{ code: 'crawl_error', message: error.message, severity: 'critical' }],
                crawledAt: new Date()
            };
        } finally {
            await page.close();
        }
    }
}
