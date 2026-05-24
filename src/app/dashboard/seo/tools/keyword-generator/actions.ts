"use server";

export async function fetchKeywords(seed: string, engines: ("google" | "bing" | "youtube")[]): Promise<string[]> {
  const results = new Set<string>();

  const fetchers = engines.map(async (engine) => {
    try {
      let url = "";
      if (engine === "google") {
        url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(seed)}`;
      } else if (engine === "bing") {
        url = `https://api.bing.com/osjson.aspx?query=${encodeURIComponent(seed)}`;
      } else if (engine === "youtube") {
        url = `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(seed)}`;
      }

      if (!url) return;

      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        },
        cache: 'no-store'
      });
      
      const data = await res.json();
      
      if (Array.isArray(data) && Array.isArray(data[1])) {
        data[1].forEach((item: string) => results.add(item));
      }
    } catch (err) {
      console.error(`Error fetching from ${engine}:`, err);
    }
  });

  await Promise.all(fetchers);

  return Array.from(results);
}
