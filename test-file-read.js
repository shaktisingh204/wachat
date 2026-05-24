const { createHmac } = require('crypto');
console.log(createHmac('md5', 'secret').update('message').digest('hex'));
