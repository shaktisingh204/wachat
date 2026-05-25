import * as sbd from 'sbd';
const text = "Hello.\n\nWorld!  How are you? \"This is a quote!\"";
const sentences = sbd.sentences(text, { newline_boundaries: true });
console.log(sentences);
let rem = text;
for (const s of sentences) {
  const i = rem.indexOf(s);
  if (i !== -1) {
    console.log(`Found: ${s}`);
    rem = rem.substring(i + s.length);
  } else {
    console.log(`Not found: ${s}`);
  }
}
