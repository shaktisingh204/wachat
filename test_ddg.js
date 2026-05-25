async function test() {
  const res = await fetch("https://html.duckduckgo.com/html/?q=react+hooks", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
  });
  const text = await res.text();
  
  const results = [];
  const regex = /<a class="result__url" href="([^"]+)".*?>(.*?)<\/a>/gis;
  
  // Actually, wait, let's look for result__title
  const titleRegex = /<h2 class="result__title">\s*<a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gis;
  let match;
  while ((match = titleRegex.exec(text)) !== null) {
      if (results.length >= 10) break;
      let url = match[1];
      let title = match[2].replace(/<[^>]+>/g, '').trim();
      if (url.startsWith('//duckduckgo.com/l/?')) {
          const urlParams = new URLSearchParams(url.split('?')[1]);
          url = decodeURIComponent(urlParams.get('uddg') || url);
      }
      results.push({ url, title });
  }

  console.log(results);
}
test();
