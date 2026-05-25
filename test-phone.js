const { parsePhoneNumberFromString } = require('libphonenumber-js');
function test(phone) {
  let p = phone.trim();
  if (/^\d/.test(p)) {
    p = '+' + p;
  }
  const pn = parsePhoneNumberFromString(p);
  console.log(phone, '->', pn ? pn.isValid() : false, pn ? pn.format('E.164') : null);
}
test('447911123456');
