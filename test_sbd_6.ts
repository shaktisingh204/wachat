import * as sbd from 'sbd';
const text = "First sentence. \nSecond sentence.";
console.log(sbd.sentences(text, { preserve_whitespace: true }));
