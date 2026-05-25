'use server';

export async function fetchRobotsTxt(url: string) {
  try {
    const targetUrl = new URL(url);
    if (!targetUrl.pathname.endsWith('robots.txt')) {
      targetUrl.pathname = '/robots.txt';
    }
    const response = await fetch(targetUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SabNodeBot/1.0)',
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }
    const text = await response.text();
    return { success: true, text };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
