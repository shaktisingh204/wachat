const md5 = require('md5');
console.log(md5('hello'));
console.log(md5(Buffer.from('hello')));
console.log(md5(new Uint8Array([104, 101, 108, 108, 111])));
