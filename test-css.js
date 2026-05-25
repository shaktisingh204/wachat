const html = `
<html>
<head>
  <link rel="stylesheet" href="style.css">
  <link rel="stylesheet" href="/main.css">
  <link rel="stylesheet" href="https://example.com/other.css">
  <style>
    body { font-size: 16px; }
    @media (max-width: 600px) { body { font-size: 14px; } }
  </style>
</head>
<body>
  <p>Hello</p>
</body>
</html>
`;

function extractStyles(html) {
  const styles = [];
  for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
    styles.push(m[1]);
  }
  return styles;
}

function extractLinks(html) {
  const links = [];
  for (const m of html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi)) {
    const attr = m[0].match(/href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const href = attr?.[1] || attr?.[2] || attr?.[3];
    if (href) links.push(href);
  }
  return links;
}

console.log("styles", extractStyles(html));
console.log("links", extractLinks(html));

