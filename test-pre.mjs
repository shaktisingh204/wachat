import { minify } from 'html-minifier-terser';

const html = `
<!DOCTYPE html>
<html>
<body>
  <pre>
    function test() {
      console.log("hello");
    }
  </pre>
</body>
</html>
`;

minify(html, { collapseWhitespace: true }).then(console.log).catch(console.error);
