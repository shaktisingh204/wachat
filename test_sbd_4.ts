import * as sbd from 'sbd';
const text = "Hello there. How are you? I am fine.";
console.log(sbd.sentences(text, { preserve_whitespace: true }));
