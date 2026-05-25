import fs from 'fs';
import EXIF from 'exif-js';

const buffer = fs.readFileSync('test-image.jpg');
const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

const tags = EXIF.readFromBinaryFile(arrayBuffer);
console.log('Keys:', Object.keys(tags).length);
if (tags.GPSLatitude) {
  console.log('GPS:', tags.GPSLatitude, tags.GPSLatitudeRef);
}
