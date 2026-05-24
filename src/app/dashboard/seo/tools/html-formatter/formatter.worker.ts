import * as prettier from 'prettier/standalone';
import * as htmlPlugin from 'prettier/plugins/html';

self.onmessage = async (e: MessageEvent) => {
  const { text, reqId } = e.data;
  try {
    const formatted = await prettier.format(text, {
      parser: 'html',
      plugins: [htmlPlugin],
      printWidth: 120,
    });
    self.postMessage({ reqId, result: formatted });
  } catch (error: any) {
    self.postMessage({ reqId, error: error.message });
  }
};
