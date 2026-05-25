import { minify } from 'html-minifier-terser';

async function run() {
  const html = `<div>
    <pre>  hello   world  </pre>
    <script>
      const x = 10;
      console.log(x);
    </script>
  </div>`;
  const result = await minify(html, {
    collapseWhitespace: true,
    minifyJS: true,
  });
  console.log(result);
}
run();
