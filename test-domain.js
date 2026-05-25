const host = "www.example.com";
const u = new URL("https://example.com");
console.log(host.endsWith('.' + u.hostname) || u.hostname.endsWith('.' + host) || host === u.hostname);
