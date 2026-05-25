import * as sbd from 'sbd';
const text = "Hello\n\nWorld";
console.log(sbd.sentences(text, { newline_boundaries: true }));
