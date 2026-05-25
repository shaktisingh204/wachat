fetch('http://localhost:3000/api/seo-tools/fetch-url', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ url: 'http://suggestqueries.google.com/complete/search?client=chrome&q=seo%20tools' })
}).then(res => res.json()).then(console.log);
