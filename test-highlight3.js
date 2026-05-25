function parseTagInner(inner) {
  // inner is something like ` class="container" id="main"`
  // We can match ` name="value"` 
  // It's just a test script, no React
  let parts = inner.split(/([a-zA-Z0-9-]+="[^"]*")/g);
  let res = "";
  for (let p of parts) {
     let m = p.match(/^([a-zA-Z0-9-]+)(=)("[^"]*")$/);
     if (m) {
        res += `<span class="text-yellow-500">${m[1]}</span>${m[2]}<span class="text-green-500">${m[3]}</span>`;
     } else if (p.trim() !== '') {
        // space
        res += p;
     }
  }
  return res;
}
console.log(parseTagInner(' class="container" id="main"'));
