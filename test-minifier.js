const { minify } = require("html-minifier-terser");

async function test() {
  const html = `<div class="test">
  <!-- comment -->
  <p>Hello   World</p>
  <style>
    body {
      color: red;
    }
  </style>
  <script>
    function test() {
      console.log("hello");
    }
  </script>
</div>`;

  const minified = await minify(html, {
    collapseWhitespace: true,
    removeComments: true,
    minifyJS: true,
    minifyCSS: true
  });
  console.log(minified);
}

test();
