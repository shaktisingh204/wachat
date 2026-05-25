import { htmlToText } from './src/lib/seo-tools/text-utils.ts';
const html = `
<html>
  <head>
    <style>body { color: red; }</style>
    <script>console.log('hi');</script>
  </head>
  <body>
    <h1>Title</h1>
    <div style="display: none;">Hidden</div>
    <p>Some text<br/>with a break &amp; &lt;entities&gt;.</p>
  </body>
</html>
`;

console.log("Preserving newlines, ignoring hidden, decoding entities:");
console.log(htmlToText(html, { preserveNewlines: true, ignoreHiddenElements: true, decodeEntities: true }));

console.log("----------------------");
console.log("Collapsing newlines, NOT ignoring hidden, NOT decoding entities:");
console.log(htmlToText(html, { preserveNewlines: false, ignoreHiddenElements: false, decodeEntities: false }));
