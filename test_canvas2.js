const QRCode = require('qrcode');

const test = async () => {
  try {
    const dataUrl = await QRCode.toDataURL('hello', { color: { dark: '#ff0000', light: '#00ff00' }, width: 200, errorCorrectionLevel: 'H' });
    console.log(dataUrl.substring(0, 50));
  } catch (e) {
    console.error(e);
  }
}
test();
