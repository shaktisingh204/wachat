'use server';

export async function shortenUrlAction(originalUrl: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://tinyurl.com/api-create.php?url=${encodeURIComponent(originalUrl)}`
    );
    if (!res.ok) {
      return null;
    }
    const shortUrl = await res.text();
    return shortUrl;
  } catch (error) {
    return null;
  }
}
