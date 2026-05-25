async function run() {
  const res = await fetch('http://localhost:3000/api/seo-tools/fetch-url', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://archive.org/wayback/available?url=example.com' }),
  });
  console.log(await res.json());
}
run();
