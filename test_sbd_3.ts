import * as sbd from 'sbd';
const text = "Hello.\n\nWorld!  How are you?";
console.log(sbd.sentences(text, { preserve_whitespace: true }));
