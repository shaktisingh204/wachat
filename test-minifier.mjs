import { minify } from 'html-minifier-terser';

const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      color: red;
    }
  </style>
</head>
<body>
  <h1>Hello World</h1>
  <script>
    console.log("Hello World");
  </script>
</body>
</html>
`;

minify(html, { minifyCSS: true, minifyJS: true, collapseWhitespace: true }).then(console.log).catch(console.error);
