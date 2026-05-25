const data = 'data:text/plain;base64,SGVsbG8gV29ybGQ=';
fetch(data).then(res => res.text()).then(text => console.log('Text:', text)).catch(err => console.error(err));
