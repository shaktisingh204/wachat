const md5 = require('md5');

function hexToBytes(hex) {
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substring(i, i + 2), 16));
    }
    return new Uint8Array(bytes);
}

function hmacMd5(keyStr, messageStr) {
    const key = new TextEncoder().encode(keyStr);
    const message = new TextEncoder().encode(messageStr);
    
    const blockSize = 64;
    let keyArr = Array.from(key);
    if (keyArr.length > blockSize) {
        const keyHashStr = md5(key); 
        keyArr = Array.from(hexToBytes(keyHashStr));
    }
    while (keyArr.length < blockSize) {
        keyArr.push(0);
    }
    const oPad = new Uint8Array(blockSize);
    const iPad = new Uint8Array(blockSize);
    for (let i = 0; i < blockSize; i++) {
        oPad[i] = keyArr[i] ^ 0x5c;
        iPad[i] = keyArr[i] ^ 0x36;
    }
    
    const inner = new Uint8Array(iPad.length + message.length);
    inner.set(iPad, 0);
    inner.set(message, iPad.length);
    
    const innerHashHex = md5(inner);
    const innerHash = hexToBytes(innerHashHex);
    
    const outer = new Uint8Array(oPad.length + innerHash.length);
    outer.set(oPad, 0);
    outer.set(innerHash, oPad.length);
    
    return md5(outer); 
}

console.log(hmacMd5('secret', 'message'));
